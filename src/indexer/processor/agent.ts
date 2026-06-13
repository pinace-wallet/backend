import type { RawSuiEvent } from '../../shared/sui/client.js';
import type { AgentConnectedPayload, AgentRevokedPayload } from '../../shared/types/events.js';
import type { IndexerRepository, TransactionClient } from '../repository/indexer.repository.js';

export async function handleAgentConnected(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as AgentConnectedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const owner = payload.owner;
  const expiresMs = BigInt(payload.expires_ms);
  const connectedAt = new Date(Number(event.timestampMs));

  await repo.upsertAgent(tx, {
    poolId,
    agentAddress,
    owner,
    expiresMs,
    status: 'active',
    connectedAt,
  });

  await repo.insertEventLog(tx, {
    eventType: 'AgentConnectedEvent',
    poolId,
    agentAddress,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: connectedAt,
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handleAgentRevoked(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as AgentRevokedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const revokedAt = new Date(Number(event.timestampMs));

  const found = await repo.revokeAgent(tx, poolId, agentAddress, revokedAt);
  if (!found) {
    console.warn(
      `[processor] AgentRevokedEvent received for non-existent agent: ` +
      `poolId=${poolId}, agentAddress=${agentAddress}. Skipping DB update.`
    );
  }

  await repo.insertEventLog(tx, {
    eventType: 'AgentRevokedEvent',
    poolId,
    agentAddress,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: revokedAt,
    rawPayload: { id: event.id, ...payload },
  });
}
