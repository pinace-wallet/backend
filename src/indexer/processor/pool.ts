import { Prisma } from '@prisma/client';
import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent } from '../../shared/sui/client.js';

/**
 * Handles PoolCreatedEvent.
 * Requirement: 2.1, 2.5
 */
export async function handlePoolCreated(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const owner = String(payload.owner);
  const version = Number(payload.version ?? 0);
  const createdAt = new Date(Number(event.timestampMs));

  await repo.upsertPool(tx, {
    poolId,
    owner,
    protocolVersion: version,
    status: 'active',
    createdAt,
  });

  await repo.insertEventLog(tx, {
    eventType: 'PoolCreatedEvent',
    poolId,
    agentAddress: null,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: createdAt,
    rawPayload: payload,
  });
}

/**
 * Handles DepositEvent.
 * Requirement: 2.2, 2.4, 2.5
 */
export async function handleDeposit(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const coinType = String(payload.coin_type);
  const amount = new Prisma.Decimal(String(payload.amount ?? 0));
  const timestamp = new Date(Number(event.timestampMs));

  await repo.ensurePoolExists(tx, poolId, timestamp);
  await repo.depositBalance(tx, poolId, coinType, amount);

  await repo.insertEventLog(tx, {
    eventType: 'DepositEvent',
    poolId,
    agentAddress: null,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp,
    rawPayload: payload,
  });
}

/**
 * Handles WithdrawEvent.
 * Requirement: 2.3, 2.4, 2.5
 */
export async function handleWithdraw(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const coinType = String(payload.coin_type);
  const amount = new Prisma.Decimal(String(payload.amount ?? 0));
  const timestamp = new Date(Number(event.timestampMs));

  await repo.ensurePoolExists(tx, poolId, timestamp);
  
  const { warning, overdrawnAmount } = await repo.withdrawBalance(tx, poolId, coinType, amount);
  if (warning) {
    console.warn(
      `[processor] Over-withdrawal warning for pool ${poolId}, coin ${coinType}. ` +
      `Attempted to withdraw ${amount.toString()} which exceeded available balance. ` +
      `Overdrawn amount: ${overdrawnAmount.toString()}`
    );
  }

  await repo.insertEventLog(tx, {
    eventType: 'WithdrawEvent',
    poolId,
    agentAddress: null,
    nonce: null,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp,
    rawPayload: payload,
  });
}
