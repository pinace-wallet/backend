import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent } from '../../shared/sui/client.js';
import { handlePoolCreated, handleDeposit, handleWithdraw } from './pool.js';
import { handleAgentConnected, handleAgentRevoked } from './agent.js';
import { handlePolicyAttached, handlePolicyUpdated, handlePolicyRemoved } from './policy.js';
import { handleActionProposed, handleActionSettled } from './action.js';

export class EventProcessor {
  private repo: IndexerRepository;

  constructor(repo: IndexerRepository) {
    this.repo = repo;
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
        await handlePolicyAttached(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::PolicyUpdatedEvent')) {
        await handlePolicyUpdated(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::PolicyRemovedEvent')) {
        await handlePolicyRemoved(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::ActionProposedEvent')) {
        await handleActionProposed(event, this.repo, tx, checkpointSeq);
      } else if (typeName.endsWith('::ActionSettledEvent')) {
        await handleActionSettled(event, this.repo, tx, checkpointSeq);
      } else {
        // Unknown event type, log debug and skip
        console.debug(`[processor] Skipping unrecognized event type: ${typeName}`);
      }
    }
  }
}
