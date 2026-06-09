import { Pool, PoolBalance, Agent, Policy, Action, EventLog } from '@prisma/client';
import { mapKind, mapRunStatus, mapMilestoneStatus } from '../shared/mappers.js';

export interface PoolDto {
  poolId: string;
  owner: string;
  status: string;
  protocolVersion: number;
  createdAt: string; // ISO string
  balances: { coinType: string; amount: string }[];
}

export interface PolicyDto {
  id: string;
  policyType: string;
  configHash: string | null;
  marketplaceId: string | null;
  status: string;
  attachedAt: number | null; // Unix epoch ms
  updatedAt: number | null;
  removedAt: number | null;
}

export interface AgentDto {
  id: string;
  address: string; // agentAddress
  poolId: string;
  owner: string;
  name: string; // defaults to address
  status: string;
  runStatus: 'running' | 'done' | 'idle';
  expiresMs: number;
  connectedAt: number | null;
  revokedAt: number | null;
  actionCount: number;
  lastActiveAt: number | null;
  policies?: PolicyDto[];
}

export interface ActionDto {
  id: string;
  poolId: string;
  agentAddress: string;
  nonce: number;
  kind: string;
  amountIn: string;
  minAmountOut: string;
  quotedAmountOut: string | null;
  settlementStatus: number | null;
  status: string;
  proposedAt: number | null;
  settledAt: number | null;
}

export interface MilestoneDto {
  id: string;
  agentId: string;
  action: string; // kind
  amount: string;
  coinType: string; // default ""
  timestamp: number;
  status: 'success' | 'reverted' | 'pending';
  txDigest?: string;
}

export interface EventLogDto {
  id: string;
  eventType: string;
  poolId: string;
  agentAddress: string | null;
  nonce: number | null;
  txDigest: string;
  checkpointSeq: number;
  timestamp: string; // ISO string
  rawPayload: any;
  action?: ActionDto;
}

// ─── Mapper Functions ────────────────────────────────────────────────────────

export function toPoolDto(pool: Pool & { balances: PoolBalance[] }): PoolDto {
  return {
    poolId: pool.poolId,
    owner: pool.owner,
    status: pool.status,
    protocolVersion: pool.protocolVersion,
    createdAt: pool.createdAt.toISOString(),
    balances: pool.balances.map((b) => ({
      coinType: b.coinType,
      amount: b.amount.toString(),
    })),
  };
}

export function toPolicyDto(policy: Policy): PolicyDto {
  return {
    id: policy.id,
    policyType: policy.policyType,
    configHash: policy.configHash,
    marketplaceId: policy.marketplaceId,
    status: policy.status,
    attachedAt: policy.attachedAt ? policy.attachedAt.getTime() : null,
    updatedAt: policy.updatedAt ? policy.updatedAt.getTime() : null,
    removedAt: policy.removedAt ? policy.removedAt.getTime() : null,
  };
}

export function toAgentDto(agent: Agent, actions: Action[] = []): AgentDto {
  const actionStatusInputs = actions.map((a) => ({
    status: a.status,
    settlementStatus: a.settlementStatus,
  }));

  return {
    id: agent.id,
    address: agent.agentAddress,
    poolId: agent.poolId,
    owner: agent.owner,
    name: agent.agentAddress, // name defaults to agentAddress (Requirement 10.2)
    status: agent.status,
    runStatus: mapRunStatus(actionStatusInputs),
    expiresMs: Number(agent.expiresMs),
    connectedAt: agent.connectedAt ? agent.connectedAt.getTime() : null,
    revokedAt: agent.revokedAt ? agent.revokedAt.getTime() : null,
    actionCount: agent.actionCount,
    lastActiveAt: agent.lastActiveAt ? agent.lastActiveAt.getTime() : null,
  };
}

export function toActionDto(action: Action): ActionDto {
  return {
    id: action.id,
    poolId: action.poolId,
    agentAddress: action.agentAddress,
    nonce: Number(action.nonce),
    kind: action.kind,
    amountIn: action.amountIn.toString(),
    minAmountOut: action.minAmountOut.toString(),
    quotedAmountOut: action.quotedAmountOut ? action.quotedAmountOut.toString() : null,
    settlementStatus: action.settlementStatus,
    status: action.status,
    proposedAt: action.proposedAt ? action.proposedAt.getTime() : null,
    settledAt: action.settledAt ? action.settledAt.getTime() : null,
  };
}

export function toMilestoneDto(action: Action, agentId: string, txDigest?: string): MilestoneDto {
  const timestamp = action.status === 'proposed'
    ? (action.proposedAt ? action.proposedAt.getTime() : Date.now())
    : (action.settledAt ? action.settledAt.getTime() : Date.now());

  return {
    id: action.id,
    agentId,
    action: action.kind,
    amount: action.amountIn.toString(),
    coinType: '', // default empty string if unavailable (Requirement 8.2)
    timestamp,
    status: mapMilestoneStatus({
      status: action.status,
      settlementStatus: action.settlementStatus,
    }),
    txDigest,
  };
}

export function toEventLogDto(event: EventLog, action?: Action): EventLogDto {
  return {
    id: event.id,
    eventType: event.eventType,
    poolId: event.poolId,
    agentAddress: event.agentAddress,
    nonce: event.nonce ? Number(event.nonce) : null,
    txDigest: event.txDigest,
    checkpointSeq: Number(event.checkpointSeq),
    timestamp: event.timestamp.toISOString(),
    rawPayload: event.rawPayload,
    action: action ? toActionDto(action) : undefined,
  };
}
