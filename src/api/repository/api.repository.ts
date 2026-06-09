import { PrismaClient, Pool, PoolBalance, Agent, Policy, Action, EventLog, Checkpoint } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export class ApiRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Fetches a pool and its coin balances.
   * Requirement: 7.1
   */
  async getPoolWithBalances(poolId: string): Promise<(Pool & { balances: PoolBalance[] }) | null> {
    return this.prisma.pool.findUnique({
      where: { poolId },
      include: {
        balances: true,
      },
    });
  }

  /**
   * Fetches paginated agents with optional filters.
   * Requirement: 7.2
   */
  async getAgents(
    filters: { owner?: string; poolId?: string; status?: string },
    page: number,
    limit: number
  ): Promise<PaginatedResult<Agent>> {
    const where: any = {};
    if (filters.owner) where.owner = filters.owner;
    if (filters.poolId) where.poolId = filters.poolId;
    if (filters.status) where.status = filters.status;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { connectedAt: 'desc' },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Fetches a single agent with only active ('attached') policies.
   * Requirement: 7.3, 4.5
   */
  async getAgentWithPolicies(agentId: string): Promise<(Agent & { policies: Policy[] }) | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) return null;

    // Fetch active policies for this agent address and pool
    const policies = await this.prisma.policy.findMany({
      where: {
        poolId: agent.poolId,
        agentAddress: agent.agentAddress,
        status: 'attached',
      },
    });

    return {
      ...agent,
      policies,
    };
  }

  /**
   * Fetches paginated actions with optional filters.
   * Requirement: 7.4
   */
  async getActions(
    filters: { poolId?: string; agentAddress?: string; status?: string; kind?: string },
    page: number,
    limit: number
  ): Promise<PaginatedResult<Action>> {
    const where: any = {};
    if (filters.poolId) where.poolId = filters.poolId;
    if (filters.agentAddress) where.agentAddress = filters.agentAddress;
    if (filters.status) where.status = filters.status;
    if (filters.kind) where.kind = filters.kind;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.action.findMany({
        where,
        skip,
        take: limit,
        orderBy: { proposedAt: 'desc' },
      }),
      this.prisma.action.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Fetches a single action by ID.
   * Requirement: 8.3
   */
  async getAction(actionId: string): Promise<Action | null> {
    return this.prisma.action.findUnique({
      where: { id: actionId },
    });
  }

  /**
   * Fetches actions for a specific agent (for timeline and statistics).
   */
  async getActionsForAgent(poolId: string, agentAddress: string): Promise<Action[]> {
    return this.prisma.action.findMany({
      where: { poolId, agentAddress },
    });
  }

  /**
   * Fetches paginated event logs with optional filters.
   * Requirement: 7.5
   */
  async getEvents(
    filters: { poolId?: string; agentAddress?: string; eventType?: string },
    page: number,
    limit: number
  ): Promise<PaginatedResult<EventLog>> {
    const where: any = {};
    if (filters.poolId) where.poolId = filters.poolId;
    if (filters.agentAddress) where.agentAddress = filters.agentAddress;
    if (filters.eventType) where.eventType = filters.eventType;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Fetches events for an agent timeline, ordered by timestamp ASC, capped at 200.
   * Accept an optional before cursor (ISO timestamp string) to paginate.
   * Requirement: 8.1, 8.5
   */
  async getEventsForAgentTimeline(
    poolId: string,
    agentAddress: string,
    beforeCursor?: Date
  ): Promise<EventLog[]> {
    const where: any = {
      poolId,
      agentAddress,
    };

    if (beforeCursor) {
      where.timestamp = { lt: beforeCursor };
    }

    return this.prisma.eventLog.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
  }

  /**
   * Fetches the singleton checkpoints row.
   * Requirement: 9.3
   */
  async getCheckpoint(): Promise<Checkpoint | null> {
    return this.prisma.checkpoint.findUnique({
      where: { id: 1 },
    });
  }
}
