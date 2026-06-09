import { Prisma } from '@prisma/client';
import { TransactionClient, IndexerRepository } from '../repository/indexer.repository.js';
import { RawSuiEvent } from '../../shared/sui/client.js';
import { mapKind } from '../../shared/mappers.js';

/**
 * Handles ActionProposedEvent.
 * Requirement: 5.1, 5.5, 5.6
 */
export async function handleActionProposed(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const nonce = BigInt(String(payload.nonce));
  const rawKind = Number(payload.kind ?? 0);
  const kind = mapKind(rawKind);
  const amountIn = new Prisma.Decimal(String(payload.amount_in ?? 0));
  const minAmountOut = new Prisma.Decimal(String(payload.min_amount_out ?? 0));
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

/**
 * Handles ActionSettledEvent.
 * Requirement: 5.2, 5.3, 5.4, 5.6, 5.7
 */
export async function handleActionSettled(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint
): Promise<void> {
  const payload = event.parsedJson;
  const poolId = String(payload.pool_id);
  const agentAddress = String(payload.agent);
  const nonce = BigInt(String(payload.nonce));
  const quotedAmountOut = new Prisma.Decimal(String(payload.quoted_amount_out ?? 0));
  const settlementStatus = Number(payload.settlement_status ?? 0);
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

    // Map kind and amounts to backfill
    const rawKind = Number(payload.kind ?? 0);
    const kind = mapKind(rawKind);
    const amountIn = new Prisma.Decimal(String(payload.amount_in ?? 0));
    const minAmountOut = new Prisma.Decimal(String(payload.min_amount_out ?? 0));

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
      // Skip processing of this settled event entirely by throwing, which will abort the transaction batch
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
