import { Decimal } from '@prisma/client/runtime/library';

/**
 * Maps the on-chain action kind integer to a human-readable string.
 * Requirement: 5.6
 */
export function mapKind(n: number): 'swap' | 'withdraw' | 'deposit' | 'unknown' {
  if (n === 1) return 'swap';
  if (n === 2) return 'withdraw';
  if (n === 3) return 'deposit';
  return 'unknown';
}

/**
 * Maps on-chain status integer to a display string.
 * Requirement: 5.7
 */
export function mapSettlementStatus(n: number | null): 'success' | 'failed' {
  return n === 1 ? 'success' : 'failed';
}

interface ActionStatusInput {
  status: string;
  settlementStatus: number | null;
}

/**
 * Computes agent run_status based on its actions.
 * Requirement: 3.4
 */
export function mapRunStatus(actions: ActionStatusInput[]): 'running' | 'done' | 'idle' {
  if (actions.length === 0) return 'idle';

  const hasProposed = actions.some((a) => a.status === 'proposed');
  if (hasProposed) return 'running';

  const allSettledSuccess = actions.every((a) => a.status === 'settled' && a.settlementStatus === 1);
  if (allSettledSuccess) return 'done';

  return 'idle';
}

/**
 * Maps action record to milestone status.
 * Requirement: 8.2
 */
export function mapMilestoneStatus(action: ActionStatusInput): 'success' | 'reverted' | 'pending' {
  if (action.status === 'proposed') return 'pending';
  return action.settlementStatus === 1 ? 'success' : 'reverted';
}
