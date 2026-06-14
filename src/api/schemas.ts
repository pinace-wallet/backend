import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const PoolParamsSchema = z.object({
  poolId: z.string().describe('Pool on-chain object ID'),
});

export const AgentParamsSchema = z.object({
  agentId: z.string().describe('Agent database UUID'),
});

export const ActionParamsSchema = z.object({
  actionId: z.string().describe('Action database UUID'),
});

// ─── Query strings ────────────────────────────────────────────────────────────

export const AgentQuerySchema = z.object({
  owner: z.string().optional().describe('Filter by owner address'),
  poolId: z.string().optional().describe('Filter by pool ID'),
  status: z.string().optional().describe('Filter by agent status'),
  page: z.string().optional().describe('Page number (default: 1)'),
  limit: z.string().optional().describe('Items per page (default: 20)'),
});

export const ActionQuerySchema = z.object({
  poolId: z.string().optional().describe('Filter by pool ID'),
  agentAddress: z.string().optional().describe('Filter by agent address'),
  status: z.string().optional().describe('Filter by action status'),
  kind: z.string().optional().describe('Filter by kind: swap | withdraw | deposit'),
  page: z.string().optional().describe('Page number (default: 1)'),
  limit: z.string().optional().describe('Items per page (default: 20, max: 100)'),
});

export const EventQuerySchema = z.object({
  poolId: z.string().optional().describe('Filter by pool ID'),
  agentAddress: z.string().optional().describe('Filter by agent address'),
  eventType: z.string().optional().describe('Filter by event type'),
  page: z.string().optional().describe('Page number (default: 1)'),
  limit: z.string().optional().describe('Items per page (default: 50, max: 200)'),
});

export const TimelineQuerySchema = z.object({
  before: z.string().optional().describe('ISO timestamp cursor for pagination'),
});

// ─── Response bodies ──────────────────────────────────────────────────────────

export const HealthSchema = z.object({
  status: z.enum(['ok', 'error']),
  lastCheckpoint: z.number().describe('Last indexed checkpoint sequence number'),
  lagMs: z.number().describe('Milliseconds since last checkpoint update'),
});

export const BalanceSchema = z.object({
  coinType: z.string(),
  amount: z.string(),
});

export const PoolDtoSchema = z.object({
  poolId: z.string(),
  owner: z.string(),
  status: z.string(),
  protocolVersion: z.number(),
  createdAt: z.string().describe('ISO 8601 timestamp'),
  balances: z.array(BalanceSchema),
});

export const PolicyDtoSchema = z.object({
  id: z.string(),
  policyType: z.string(),
  configHash: z.string().nullable(),
  marketplaceId: z.string().nullable(),
  config: z.record(z.unknown()).nullable().describe('Denormalized on-chain Config fields (e.g. spending_limit, slippage_bps, window_ms). Null if the on-chain read failed or backfill is pending.'),
  status: z.string(),
  attachedAt: z.number().nullable().describe('Unix epoch ms'),
  updatedAt: z.number().nullable().describe('Unix epoch ms'),
  removedAt: z.number().nullable().describe('Unix epoch ms'),
});

export const AgentDtoSchema = z.object({
  id: z.string(),
  address: z.string().describe('On-chain agent address'),
  poolId: z.string(),
  owner: z.string(),
  name: z.string(),
  status: z.string(),
  runStatus: z.enum(['running', 'done', 'idle']),
  expiresMs: z.number().describe('Unix epoch ms when agent key expires'),
  connectedAt: z.number().nullable().describe('Unix epoch ms'),
  revokedAt: z.number().nullable().describe('Unix epoch ms'),
  actionCount: z.number(),
  lastActiveAt: z.number().nullable().describe('Unix epoch ms'),
  policies: z.array(PolicyDtoSchema).optional(),
});

export const ActionDtoSchema = z.object({
  id: z.string(),
  poolId: z.string(),
  agentAddress: z.string(),
  nonce: z.number(),
  kind: z.string().describe('swap | withdraw | deposit | unknown'),
  amountIn: z.string().describe('Decimal string'),
  minAmountOut: z.string().describe('Decimal string'),
  quotedAmountOut: z.string().nullable().describe('Decimal string'),
  settlementStatus: z.number().nullable().describe('1 = success, 0 = failed'),
  status: z.string().describe('proposed | settled'),
  proposedAt: z.number().nullable().describe('Unix epoch ms'),
  settledAt: z.number().nullable().describe('Unix epoch ms'),
});

export const EventLogDtoSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  poolId: z.string(),
  agentAddress: z.string().nullable(),
  nonce: z.number().nullable(),
  txDigest: z.string(),
  checkpointSeq: z.number(),
  timestamp: z.string().describe('ISO 8601 timestamp'),
  rawPayload: z.unknown(),
  action: ActionDtoSchema.optional(),
});

export const MilestoneDtoSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  action: z.string().describe('kind of the underlying action'),
  amount: z.string().describe('Decimal string'),
  coinType: z.string(),
  timestamp: z.number().describe('Unix epoch ms'),
  status: z.enum(['success', 'reverted', 'pending']),
  txDigest: z.string().optional(),
});

const paginatedOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  });

export const PaginatedAgentSchema = paginatedOf(AgentDtoSchema);
export const PaginatedActionSchema = paginatedOf(ActionDtoSchema);
export const PaginatedEventSchema = paginatedOf(EventLogDtoSchema);

export const TimelineDtoSchema = z.object({
  events: z.array(EventLogDtoSchema),
  milestones: z.array(MilestoneDtoSchema),
  summary: z.object({
    actionCount: z.number(),
    successRate: z.number().nullable().describe('0–100, null if no settled actions'),
    lastActiveAt: z.number().nullable().describe('Unix epoch ms'),
    totalVolumeByKind: z.record(z.string()).describe('kind → decimal string sum'),
  }),
  hasMore: z.boolean(),
});
