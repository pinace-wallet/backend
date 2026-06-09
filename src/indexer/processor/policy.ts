import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent } from '../../shared/sui/client.js';

/**
 * Handles PolicyAttachedEvent.
 * Requirement: 4.1, 4.4
 */
export async function handlePolicyAttached(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const policyType = String(payload.policy_type);
  const configHash = payload.config_hash ? String(payload.config_hash) : null;
  const marketplaceId = payload.marketplace_id ? String(payload.marketplace_id) : null;
  const attachedAt = new Date(Number(event.timestampMs));

  await repo.upsertPolicy(tx, {
    poolId,
    agentAddress,
    policyType,
    configHash,
    marketplaceId,
    status: 'attached',
    attachedAt,
  });

  await repo.insertEventLog(tx, {
    eventType: 'PolicyAttachedEvent',
    poolId,
    agentAddress,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: attachedAt,
    rawPayload: {
      id: event.id,
      ...payload,
      marketplace_id: marketplaceId, // Ensure marketplace_id is in payload
    },
  });
}

/**
 * Handles PolicyUpdatedEvent.
 * Requirement: 4.2, 4.4
 */
export async function handlePolicyUpdated(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const policyType = String(payload.policy_type);
  const configHash = payload.config_hash ? String(payload.config_hash) : null;
  const marketplaceId = payload.marketplace_id ? String(payload.marketplace_id) : null;
  const updatedAt = new Date(Number(event.timestampMs));

  const found = await repo.updatePolicy(tx, {
    poolId,
    agentAddress,
    policyType,
    configHash,
    marketplaceId,
    updatedAt,
  });

  if (!found) {
    console.warn(
      `[processor] PolicyUpdatedEvent received for non-existent policy: ` +
      `poolId=${poolId}, agentAddress=${agentAddress}, policyType=${policyType}. Skipping.`
    );
  }

  await repo.insertEventLog(tx, {
    eventType: 'PolicyUpdatedEvent',
    poolId,
    agentAddress,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: updatedAt,
    rawPayload: {
      id: event.id,
      ...payload,
      marketplace_id: marketplaceId,
    },
  });
}

/**
 * Handles PolicyRemovedEvent.
 * Requirement: 4.3, 4.4
 */
export async function handlePolicyRemoved(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const policyType = String(payload.policy_type);
  const removedAt = new Date(Number(event.timestampMs));

  const found = await repo.removePolicy(tx, poolId, agentAddress, policyType, removedAt);
  if (!found) {
    console.warn(
      `[processor] PolicyRemovedEvent received for non-existent policy: ` +
      `poolId=${poolId}, agentAddress=${agentAddress}, policyType=${policyType}. Skipping.`
    );
  }

  await repo.insertEventLog(tx, {
    eventType: 'PolicyRemovedEvent',
    poolId,
    agentAddress,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: removedAt,
    rawPayload: { id: event.id, ...payload },
  });
}
