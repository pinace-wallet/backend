import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent, SuiClientWrapper } from '../../shared/sui/client.js';
import { handlePoolCreated, handleDeposit, handleWithdraw } from './pool.js';
import { handleAgentConnected, handleAgentRevoked } from './agent.js';
import { handlePolicyAttached, handlePolicyUpdated, handlePolicyRemoved } from './policy.js';
import {
  handleActionProposed,
  handleActionSettled,
  handleFlowAuthorized,
  handleFlowCompleted,
} from './action.js';
import { ssePublisher, SseEventKind } from '../../shared/sse/publisher.js';

/**
 * Map Move event type suffix → SSE event kind. After the DB write lands
 * we fan the event out to any /stream subscriber matching owner/pool.
 */
const TYPE_TO_KIND: Record<string, SseEventKind> = {
  PoolCreatedEvent: 'pool_created',
  DepositEvent: 'pool_deposit',
  WithdrawEvent: 'pool_withdraw',
  AgentConnectedEvent: 'agent_connected',
  AgentRevokedEvent: 'agent_revoked',
  PolicyAttachedEvent: 'policy_attached',
  PolicyUpdatedEvent: 'policy_updated',
  PolicyRemovedEvent: 'policy_removed',
  ActionProposedEvent: 'action_proposed',
  ActionSettledEvent: 'action_settled',
  FlowAuthorizedEvent: 'pool_withdraw',
  FlowCompletedEvent: 'pool_deposit',
};

function suffix(typeName: string): string | null {
  // "0x...::events::PoolCreatedEvent" → "PoolCreatedEvent"
  const parts = typeName.split('::');
  return parts[parts.length - 1] ?? null;
}

export class EventProcessor {
  private repo: IndexerRepository;
  private suiClient: SuiClientWrapper;

  constructor(repo: IndexerRepository, suiClient: SuiClientWrapper) {
    this.repo = repo;
    this.suiClient = suiClient;
  }

  /**
   * Processes a batch of events within a single database transaction.
   * Requirement: 1.6, 9.1
   */
  async processBatch(
    events: RawSuiEvent[],
    tx: TransactionClient,
    checkpointSeq: bigint
  ): Promise<void> {
    for (const event of events) {
      // Idempotency check: Skip event if already processed
      const existingLogs = await tx.eventLog.findMany({
        where: { txDigest: event.id.txDigest },
        select: { rawPayload: true },
      });

      const isDuplicate = existingLogs.some((log) => {
        const payload = log.rawPayload as any;
        return payload && payload.id && payload.id.eventSeq === event.id.eventSeq;
      });

      if (isDuplicate) {
        console.info(
          `[processor] Skipping already processed event: txDigest=${event.id.txDigest}, eventSeq=${event.id.eventSeq}`
        );
        continue;
      }

      const typeName = event.type;
      
      // Dispatch based on Move event type suffix
      if (typeName.endsWith('::PoolCreatedEvent')) {
        await handlePoolCreated(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::DepositEvent')) {
        await handleDeposit(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::WithdrawEvent')) {
        await handleWithdraw(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::AgentConnectedEvent')) {
        await handleAgentConnected(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::AgentRevokedEvent')) {
        await handleAgentRevoked(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::PolicyAttachedEvent')) {
        await handlePolicyAttached(event, this.repo, tx, checkpointSeq, this.suiClient);
      } else if (typeName.endsWith('::PolicyUpdatedEvent')) {
        await handlePolicyUpdated(event, this.repo, tx, checkpointSeq, this.suiClient);
      } else if (typeName.endsWith('::PolicyRemovedEvent')) {
        await handlePolicyRemoved(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::ActionProposedEvent')) {
        await handleActionProposed(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::ActionSettledEvent')) {
        await handleActionSettled(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::FlowAuthorizedEvent')) {
        await handleFlowAuthorized(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::FlowCompletedEvent')) {
        await handleFlowCompleted(event, this.repo, tx, checkpointSeq);
      } else {
        // Unknown event type, log debug and skip
        console.debug(`[processor] Skipping unrecognized event type: ${typeName}`);
        continue;
      }

      // Single SSE fan-out point — runs after every recognised handler
      // succeeds. Pulls owner / pool / agent from the parsed payload so
      // subscribers can filter without re-querying the DB.
      const kind = TYPE_TO_KIND[suffix(typeName) ?? ''];
      if (kind) {
        const p = (event.parsedJson ?? {}) as Record<string, unknown>;
        const owner =
          typeof p.owner === 'string'
            ? p.owner.toLowerCase()
            : undefined;
        const poolId =
          typeof p.pool_id === 'string' ? p.pool_id : undefined;
        const agentAddress =
          typeof p.agent === 'string'
            ? p.agent
            : typeof p.agent_address === 'string'
              ? p.agent_address
              : undefined;
        ssePublisher.publish({
          kind,
          owner,
          poolId,
          agentAddress,
          ts: Date.now(),
          data: { txDigest: event.id.txDigest, ...p },
        });
      }
    }
  }
}
