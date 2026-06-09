import { Prisma } from '@prisma/client';
import { ApiRepository } from '../repository/api.repository.js';
import * as mappers from '../mappers.js';
import { PoolDto, AgentDto, ActionDto, EventLogDto, MilestoneDto } from '../mappers.js';

export interface PaginatedDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TimelineDto {
  events: EventLogDto[];
  milestones: MilestoneDto[];
  summary: {
    actionCount: number;
    successRate: number | null;
    lastActiveAt: number | null;
    totalVolumeByKind: Record<string, string>;
  };
  hasMore: boolean;
}

export class ApiService {
  private repo: ApiRepository;

  constructor(repo: ApiRepository) {
    this.repo = repo;
  }

  /**
   * Fetches and maps pool details.
   * Requirement: 7.1
   */
  async getPool(poolId: string): Promise<PoolDto | null> {
    const pool = await this.repo.getPoolWithBalances(poolId);
    if (!pool) return null;
    return mappers.toPoolDto(pool);
  }

  /**
   * Fetches paginated agents with run_status and pagination metadata.
   * Requirement: 7.2, 7.6
   */
  async getAgents(
    filters: { owner?: string; poolId?: string; status?: string },
    page: number,
    limit: number
  ): Promise<PaginatedDto<AgentDto>> {
    const { data: agents, total } = await this.repo.getAgents(filters, page, limit);

    // Map each agent and compute run_status by fetching their actions
    const agentDtos: AgentDto[] = [];
    for (const agent of agents) {
      const actions = await this.repo.getActionsForAgent(agent.poolId, agent.agentAddress);
      agentDtos.push(mappers.toAgentDto(agent, actions));
    }

    return {
      data: agentDtos,
      total,
      page,
      limit,
    };
  }

  /**
   * Fetches a single agent with active policies and runStatus computed.
   * Requirement: 7.3, 4.5
   */
  async getAgent(agentId: string): Promise<AgentDto | null> {
    const result = await this.repo.getAgentWithPolicies(agentId);
    if (!result) return null;

    const { policies, ...agent } = result;
    const actions = await this.repo.getActionsForAgent(agent.poolId, agent.agentAddress);
    const agentDto = mappers.toAgentDto(agent, actions);
    
    // Add policies mapped to DTOs
    agentDto.policies = policies.map(mappers.toPolicyDto);
    return agentDto;
  }

  /**
   * Fetches paginated actions.
   * Requirement: 7.4, 7.6
   */
  async getActions(
    filters: { poolId?: string; agentAddress?: string; status?: string; kind?: string },
    page: number,
    limit: number
  ): Promise<PaginatedDto<ActionDto>> {
    const { data: actions, total } = await this.repo.getActions(filters, page, limit);
    return {
      data: actions.map(mappers.toActionDto),
      total,
      page,
      limit,
    };
  }

  /**
   * Fetches a single action.
   * Requirement: 8.3
   */
  async getAction(actionId: string): Promise<ActionDto | null> {
    const action = await this.repo.getAction(actionId);
    if (!action) return null;
    return mappers.toActionDto(action);
  }

  /**
   * Fetches paginated event logs.
   * Requirement: 7.5, 7.6
   */
  async getEvents(
    filters: { poolId?: string; agentAddress?: string; eventType?: string },
    page: number,
    limit: number
  ): Promise<PaginatedDto<EventLogDto>> {
    const { data: events, total } = await this.repo.getEvents(filters, page, limit);
    return {
      data: events.map((e) => mappers.toEventLogDto(e)),
      total,
      page,
      limit,
    };
  }

  /**
   * Generates a timeline (milestones, events list, summary statistics) for a specific agent.
   * Requirement: 8.1, 8.2, 8.4, 8.5
   */
  async getAgentTimeline(agentId: string, beforeCursor?: Date): Promise<TimelineDto | null> {
    // 1. Fetch agent to verify existence and get keys
    const agent = await this.repo.getAgentWithPolicies(agentId);
    if (!agent) return null;

    const { poolId, agentAddress } = agent;

    // 2. Fetch all actions for computing statistics and matching milestones
    const actions = await this.repo.getActionsForAgent(poolId, agentAddress);

    // 3. Fetch capped list of timeline event logs (up to 200)
    const eventLogs = await this.repo.getEventsForAgentTimeline(poolId, agentAddress, beforeCursor);

    // 4. Map event logs, attaching full action details on action proposed/settled events
    const eventDtos = eventLogs.map((e) => {
      let matchingAction;
      if (e.nonce !== null) {
        matchingAction = actions.find((a) => a.nonce === e.nonce);
      }
      return mappers.toEventLogDto(e, matchingAction);
    });

    // 5. Build Milestones: One milestone per action, attaching settled txDigest if available
    const milestoneDtos: MilestoneDto[] = actions.map((action) => {
      // Find the corresponding ActionSettledEvent or ActionProposedEvent in event logs to retrieve tx_digest
      const matchedLog = eventLogs.find(
        (e) => e.nonce === action.nonce && e.eventType === (action.status === 'settled' ? 'ActionSettledEvent' : 'ActionProposedEvent')
      );
      return mappers.toMilestoneDto(action, agent.id, matchedLog?.txDigest);
    });

    // 6. Compute statistics summary
    const settledActions = actions.filter((a) => a.status === 'settled');
    const successfulSettled = settledActions.filter((a) => a.settlementStatus === 1);
    const successRate = settledActions.length > 0
      ? Number(((successfulSettled.length / settledActions.length) * 100).toFixed(1))
      : null;

    // Find last active timestamp
    let lastActiveAt: number | null = null;
    const timestamps = actions
      .flatMap((a) => [a.proposedAt?.getTime(), a.settledAt?.getTime()])
      .filter((t): t is number => t !== undefined && t !== null);
    if (timestamps.length > 0) {
      lastActiveAt = Math.max(...timestamps);
    }

    // Accumulate total volume by kind
    const totalVolumeByKind: Record<string, string> = {};
    for (const action of settledActions) {
      const kind = action.kind;
      const currentSum = new Prisma.Decimal(totalVolumeByKind[kind] || '0');
      totalVolumeByKind[kind] = currentSum.plus(action.amountIn).toString();
    }

    // If we fetched 200 events, there might be more remaining on chain/in DB before the oldest one
    const hasMore = eventLogs.length >= 200;

    return {
      events: eventDtos,
      milestones: milestoneDtos,
      summary: {
        actionCount: actions.length,
        successRate,
        lastActiveAt,
        totalVolumeByKind,
      },
      hasMore,
    };
  }

  /**
   * Computes health statistics (lag) from checkpoints singleton.
   * Requirement: 9.3
   */
  async getHealthStatus(): Promise<{ status: 'ok' | 'error'; lastCheckpoint: number; lagMs: number }> {
    const cp = await this.repo.getCheckpoint();
    const lastCheckpoint = cp ? Number(cp.lastCheckpointSeq) : 0;
    const updatedAt = cp ? cp.updatedAt.getTime() : 0;
    const lagMs = Date.now() - updatedAt;

    // Healthy if updated within last 60 seconds (60000 ms)
    const status = lagMs <= 60000 ? 'ok' : 'error';

    return {
      status,
      lastCheckpoint,
      lagMs,
    };
  }
}
