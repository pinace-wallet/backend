import type { Prisma } from '@prisma/client';
import type { RawSuiEvent, SuiClientWrapper } from '../../shared/sui/client.js';
import type { PolicyAttachedPayload, PolicyRemovedPayload, PolicyUpdatedPayload } from '../../shared/types/events.js';
import { bytesToHex } from '../../shared/types/events.js';
import type { IndexerRepository, TransactionClient } from '../repository/indexer.repository.js';

export async function handlePolicyAttached(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint,
  suiClient?: SuiClientWrapper,
): Promise<void> {
  const payload = event.parsedJson as unknown as PolicyAttachedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const policyType = payload.policy_type.name;
  const configHash = bytesToHex(payload.config_hash);
  const marketplaceId = bytesToHex(payload.marketplace_id);
  const attachedAt = new Date(Number(event.timestampMs));

  const rawConfig = suiClient
    ? await suiClient.readPolicyConfig(poolId, agentAddress, policyType)
    : null;
  const config = (rawConfig ?? null) as Prisma.InputJsonValue | null;

  await repo.upsertPolicy(tx, {
    poolId,
    agentAddress,
    policyType,
    configHash,
    marketplaceId,
    config,
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
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handlePolicyUpdated(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint,
  suiClient?: SuiClientWrapper,
): Promise<void> {
  const payload = event.parsedJson as unknown as PolicyUpdatedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const policyType = payload.policy_type.name;
  const configHash = bytesToHex(payload.config_hash);
  const marketplaceId = bytesToHex(payload.marketplace_id);
  const updatedAt = new Date(Number(event.timestampMs));

  const rawConfig = suiClient
    ? await suiClient.readPolicyConfig(poolId, agentAddress, policyType)
    : null;
  const config = (rawConfig ?? null) as Prisma.InputJsonValue | null;

  const found = await repo.updatePolicy(tx, {
    poolId,
    agentAddress,
    policyType,
    configHash,
    marketplaceId,
    config,
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
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handlePolicyRemoved(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as PolicyRemovedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const policyType = payload.policy_type.name;
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
