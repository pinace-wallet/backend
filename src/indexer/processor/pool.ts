import { Prisma } from '@prisma/client';
import type { RawSuiEvent } from '../../shared/sui/client.js';
import type { DepositPayload, PoolCreatedPayload, WithdrawPayload } from '../../shared/types/events.js';
import type { IndexerRepository, TransactionClient } from '../repository/indexer.repository.js';

export async function handlePoolCreated(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as PoolCreatedPayload;
  const poolId = payload.pool_id;
  const owner = payload.owner;
  const version = Number(payload.version);
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
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handleDeposit(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as DepositPayload;
  const poolId = payload.pool_id;
  const coinType = payload.coin_type.name;
  const amount = new Prisma.Decimal(payload.amount);
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
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handleWithdraw(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as WithdrawPayload;
  const poolId = payload.pool_id;
  const coinType = payload.coin_type.name;
  const amount = new Prisma.Decimal(payload.amount);
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
    rawPayload: { id: event.id, ...payload },
  });
}
