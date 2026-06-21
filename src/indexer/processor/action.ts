import { Prisma } from '@prisma/client';
import type { RawSuiEvent } from '../../shared/sui/client.js';
import type { ActionProposedPayload, ActionSettledPayload } from '../../shared/types/events.js';
import { mapKind } from '../../shared/mappers.js';
import type { IndexerRepository, TransactionClient } from '../repository/indexer.repository.js';

/**
 * Re-implement spending_limit_policy::prove window math in TS so the
 * indexer's denormalized policy.config (spent_in_window, window_started_ms)
 * advances in lockstep with chain. Called from handleFlowAuthorized.
 */
async function bumpSpendingLimitSpent(
  tx: TransactionClient,
  poolId: string,
  agentAddress: string,
  amount: Prisma.Decimal,
  swapTs: Date,
): Promise<void> {
  const rows = await tx.policy.findMany({
    where: { poolId, agentAddress, status: 'attached' },
  });
  for (const row of rows) {
    // Only the spending-limit policy carries a window_ms / spent_in_window.
    if (!row.policyType.endsWith('::spending_limit_policy::Witness')) continue;
    const cfg = (row.config ?? {}) as Record<string, string | number>;
    const windowMs = BigInt(cfg.window_ms ?? '0');
    if (windowMs === 0n) continue;
    const windowStartedMs = BigInt(cfg.window_started_ms ?? '0');
    const spentInWindow = BigInt(cfg.spent_in_window ?? '0');
    const nowMs = BigInt(swapTs.getTime());
    const amt = BigInt(amount.toFixed(0));
    let nextStart = windowStartedMs;
    let nextSpent = spentInWindow;
    if (windowStartedMs === 0n || nowMs - windowStartedMs >= windowMs) {
      nextStart = nowMs;
      nextSpent = amt;
    } else {
      nextSpent = spentInWindow + amt;
    }
    await tx.policy.update({
      where: { id: row.id },
      data: {
        config: {
          ...cfg,
          spent_in_window: nextSpent.toString(),
          window_started_ms: nextStart.toString(),
        },
        updatedAt: swapTs,
      },
    });
  }
}

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

/**
 * Pinace's `take_coin` (flow-mode swap step) emits FlowAuthorizedEvent.
 * It withdraws `amount_in` of `coin_in` from the pool's internal balance
 * ledger. Deposit/Withdraw event handlers don't fire for flow-mode swaps,
 * so without this the indexer's denormalized pool_balances stays stale
 * after every swap.
 */
export async function handleFlowAuthorized(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint,
): Promise<void> {
  const payload = event.parsedJson as unknown as {
    pool_id: string;
    agent: string;
    nonce: string;
    amount_in: string;
    coin_in: { name: string };
  };
  const poolId = payload.pool_id;
  const coinIn = payload.coin_in.name;
  const amountIn = new Prisma.Decimal(payload.amount_in);
  const ts = new Date(Number(event.timestampMs));

  await repo.ensurePoolExists(tx, poolId, ts);
  const { warning } = await repo.withdrawBalance(tx, poolId, coinIn, amountIn);
  if (warning) {
    console.warn(
      `[processor] FlowAuthorized over-withdraw for ${poolId} ${coinIn} ${amountIn}`,
    );
  }
  // Replicate spending_limit_policy::prove window math so the indexer's
  // denormalized config.spent_in_window stays in lockstep with chain.
  // Without this, Fenik's checkSwapAllowed reads stale 0 and waves
  // through swaps that on-chain prove() then aborts with abort 102.
  await bumpSpendingLimitSpent(tx, poolId, payload.agent, amountIn, ts);
  await repo.insertEventLog(tx, {
    eventType: 'FlowAuthorizedEvent',
    poolId,
    agentAddress: payload.agent,
    nonce: BigInt(payload.nonce),
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: ts,
    rawPayload: { id: event.id, ...payload },
  });
}

/**
 * Pinace's `return_coin` emits FlowCompletedEvent. It deposits
 * `amount_out` of `coin_out` back into the pool's internal balance
 * ledger after the external swap completes.
 */
export async function handleFlowCompleted(
  event: RawSuiEvent,
  repo: IndexerRepository,
  tx: TransactionClient,
  checkpointSeq: bigint,
): Promise<void> {
  const payload = event.parsedJson as unknown as {
    pool_id: string;
    agent: string;
    nonce: string;
    amount_out: string;
    coin_out: { name: string };
  };
  const poolId = payload.pool_id;
  const coinOut = payload.coin_out.name;
  const amountOut = new Prisma.Decimal(payload.amount_out);
  const ts = new Date(Number(event.timestampMs));

  await repo.ensurePoolExists(tx, poolId, ts);
  await repo.depositBalance(tx, poolId, coinOut, amountOut);

  await repo.insertEventLog(tx, {
    eventType: 'FlowCompletedEvent',
    poolId,
    agentAddress: payload.agent,
    nonce: BigInt(payload.nonce),
    txDigest: event.id.txDigest,
    checkpointSeq,
    timestamp: ts,
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
