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

  // Defensive: if we re-pointed the indexer at a different package
  // mid-stream (or the PoolCreatedEvent landed in a checkpoint range
  // we hadn't polled yet), the pool FK target is missing and the
  // upsertAgent below explodes with `agents_pool_id_fkey`. Backfill a
  // placeholder pool row so the FK holds; PoolCreatedEvent (if it ever
  // arrives) will upsert real fields over it via upsertPool.
  await repo.ensurePoolExists(tx, poolId, connectedAt);

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
