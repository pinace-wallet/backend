import { Prisma } from '@prisma/client';
import type { RawSuiEvent } from '../../shared/sui/client.js';
import type { ActionProposedPayload, ActionSettledPayload } from '../../shared/types/events.js';
import { mapKind } from '../../shared/mappers.js';
import type { IndexerRepository, TransactionClient } from '../repository/indexer.repository.js';

export async function handleActionProposed(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as ActionProposedPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const nonce = BigInt(payload.nonce);
  const kind = mapKind(payload.kind);
  const amountIn = new Prisma.Decimal(payload.amount_in);
  const minAmountOut = new Prisma.Decimal(payload.min_amount_out);
  const proposedAt = new Date(Number(event.timestampMs));

  const success = await repo.insertActionProposed(tx, {
    poolId,
    agentAddress,
    nonce,
    kind,
    amountIn,
    minAmountOut,
    proposedAt,
  });

  if (!success) {
    console.warn(
      `[processor] Duplicate proposed action ignored: ` +
      `poolId=${poolId}, agentAddress=${agentAddress}, nonce=${nonce.toString()}`
    );
  }

  await repo.insertEventLog(tx, {
    eventType: 'ActionProposedEvent',
    poolId,
    agentAddress,
    nonce,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: proposedAt,
    rawPayload: { id: event.id, ...payload },
  });
}

export async function handleActionSettled(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson as unknown as ActionSettledPayload;
  const poolId = payload.pool_id;
  const agentAddress = payload.agent;
  const nonce = BigInt(payload.nonce);
  const quotedAmountOut = new Prisma.Decimal(payload.quoted_amount_out);
  const settlementStatus = payload.status;
  const settledAt = new Date(Number(event.timestampMs));

  const updated = await repo.updateActionSettled(tx, {
    poolId,
    agentAddress,
    nonce,
    quotedAmountOut,
    settlementStatus,
    settledAt,
  });

  if (!updated) {
    console.info(
      `[processor] ActionProposedEvent not found for settled action. Backfilling: ` +
      `poolId=${poolId}, agentAddress=${agentAddress}, nonce=${nonce.toString()}`
    );

    const kind = mapKind(payload.kind);
    const amountIn = new Prisma.Decimal(payload.amount_in);
    const minAmountOut = new Prisma.Decimal(payload.min_amount_out);

    try {
      await repo.backfillActionSettled(tx, {
        poolId,
        agentAddress,
        nonce,
        kind,
        amountIn,
        minAmountOut,
        quotedAmountOut,
        settlementStatus,
        settledAt,
      });
    } catch (err) {
      console.error(
        `[processor] Backfill action failed: poolId=${poolId}, agentAddress=${agentAddress}, nonce=${nonce.toString()}`,
        err
      );
      throw err;
    }
  }

  await repo.insertEventLog(tx, {
    eventType: 'ActionSettledEvent',
    poolId,
    agentAddress,
    nonce,
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: settledAt,
    rawPayload: { id: event.id, ...payload },
  });
}
