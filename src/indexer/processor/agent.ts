import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent } from '../../shared/sui/client.js';

/**
 * Handles AgentConnectedEvent.
 * Requirement: 3.1
 */
export async function handleAgentConnected(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const owner = String(payload.owner);
  const expiresMs = BigInt(String(payload.expires_ms ?? 0));
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

/**
 * Handles AgentRevokedEvent.
 * Requirement: 3.2, 3.3
 */
export async function handleAgentRevoked(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
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
