import { PrismaClient, Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export class IndexerRepository {
  /**
   * Reads the last processed checkpoint cursor.
   * Requirement: 1.2
   */
  async getCheckpoint(tx: TransactionClient): Promise<bigint | null> {
    const cp = await tx.checkpoint.findUnique({
      where: { id: 1 },
    });
    return cp ? cp.lastCheckpointSeq : null;
  }

  /**
   * Saves the checkpoint cursor.
   * Requirement: 1.6
   */
  async upsertCheckpoint(tx: TransactionClient, seq: bigint): Promise<void> {
    await tx.checkpoint.upsert({
      where: { id: 1 },
      create: { id: 1, lastCheckpointSeq: seq, updatedAt: new Date() },
      update: { lastCheckpointSeq: seq, updatedAt: new Date() },
    });
  }

  /**
   * Upserts a Pool record on PoolCreatedEvent.
   * Requirement: 2.1
   */
  async upsertPool(
    tx: TransactionClient,
    data: { poolId: string; owner: string; protocolVersion: number; status: string; createdAt: Date }
  ): Promise<void> {
    await tx.pool.upsert({
      where: { poolId: data.poolId },
      create: {
        poolId: data.poolId,
        owner: data.owner,
        protocolVersion: data.protocolVersion,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: new Date(),
      },
      update: {
        owner: data.owner,
        protocolVersion: data.protocolVersion,
        status: data.status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Helper: Inserts a placeholder pool with status 'unknown' if it doesn't exist.
   * Requirement: 2.4
   */
  async ensurePoolExists(tx: TransactionClient, poolId: string, createdAt: Date): Promise<void> {
    const pool = await tx.pool.findUnique({
      where: { poolId },
    });
    if (!pool) {
      await tx.pool.create({
        data: {
          poolId,
          owner: 'unknown',
          status: 'unknown',
          createdAt,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Atomic deposit balance update.
   * Requirement: 2.2
   */
  async depositBalance(
    tx: TransactionClient,
    poolId: string,
    coinType: string,
    amount: Prisma.Decimal
  ): Promise<void> {
    // We use a raw SQL query to guarantee atomic upsert and add arithmetic
    await tx.$executeRaw`
      INSERT INTO pool_balances (pool_id, coin_type, amount, updated_at)
      VALUES (${poolId}, ${coinType}, ${amount}, NOW())
      ON CONFLICT (pool_id, coin_type) DO UPDATE
      SET amount = pool_balances.amount + ${amount},
          updated_at = NOW()
    `;
  }

  /**
   * Atomic withdraw balance update (floored at 0).
   * Returns the new amount or logs warning if negative was prevented.
   * Requirement: 2.3
   */
  async withdrawBalance(
    tx: TransactionClient,
    poolId: string,
    coinType: string,
    amount: Prisma.Decimal
  ): Promise<{ warning: boolean; overdrawnAmount: Prisma.Decimal }> {
    // 1. Fetch current balance to check if it will go negative
    const balance = await tx.poolBalance.findUnique({
      where: { poolId_coinType: { poolId, coinType } },
    });

    const currentAmount = balance ? balance.amount : new Prisma.Decimal(0);
    const newAmount = currentAmount.minus(amount);
    let warning = false;
    let overdrawnAmount = new Prisma.Decimal(0);

    if (newAmount.isNegative()) {
      warning = true;
      overdrawnAmount = amount.minus(currentAmount);
    }

    // 2. Perform atomic subtraction with GREATEST(0, amount - withdrawn)
    await tx.$executeRaw`
      INSERT INTO pool_balances (pool_id, coin_type, amount, updated_at)
      VALUES (${poolId}, ${coinType}, 0, NOW())
      ON CONFLICT (pool_id, coin_type) DO UPDATE
      SET amount = GREATEST(0, pool_balances.amount - ${amount}),
          updated_at = NOW()
    `;

    return { warning, overdrawnAmount };
  }

  /**
   * Upserts Agent delegation on AgentConnectedEvent.
   * Requirement: 3.1
   */
  async upsertAgent(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      owner: string;
      expiresMs: bigint;
      status: string;
      connectedAt: Date;
    }
  ): Promise<void> {
    await tx.agent.upsert({
      where: { poolId_agentAddress: { poolId: data.poolId, agentAddress: data.agentAddress } },
      create: {
        poolId: data.poolId,
        agentAddress: data.agentAddress,
        owner: data.owner,
        expiresMs: data.expiresMs,
        status: data.status,
        connectedAt: data.connectedAt,
      },
      update: {
        owner: data.owner,
        expiresMs: data.expiresMs,
        status: data.status,
        connectedAt: data.connectedAt,
      },
    });
  }

  /**
   * Revokes an agent on AgentRevokedEvent.
   * Requirement: 3.2, 3.3
   */
  async revokeAgent(
    tx: TransactionClient,
    poolId: string,
    agentAddress: string,
    revokedAt: Date
  ): Promise<boolean> {
    const agent = await tx.agent.findUnique({
      where: { poolId_agentAddress: { poolId, agentAddress } },
    });
    if (!agent) return false;

    await tx.agent.update({
      where: { poolId_agentAddress: { poolId, agentAddress } },
      data: {
        status: 'revoked',
        revokedAt,
      },
    });
    return true;
  }

  /**
   * Upserts policy binding.
   * Requirement: 4.1
   */
  async upsertPolicy(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      policyType: string;
      configHash: string | null;
      marketplaceId: string | null;
      status: string;
      attachedAt: Date;
    }
  ): Promise<void> {
    await tx.policy.upsert({
      where: {
        poolId_agentAddress_policyType: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          policyType: data.policyType,
        },
      },
      create: {
        poolId: data.poolId,
        agentAddress: data.agentAddress,
        policyType: data.policyType,
        configHash: data.configHash,
        marketplaceId: data.marketplaceId,
        status: data.status,
        attachedAt: data.attachedAt,
      },
      update: {
        configHash: data.configHash,
        marketplaceId: data.marketplaceId,
        status: data.status,
        attachedAt: data.attachedAt,
      },
    });
  }

  /**
   * Updates policy config.
   * Requirement: 4.2
   */
  async updatePolicy(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      policyType: string;
      configHash: string | null;
      marketplaceId: string | null;
      updatedAt: Date;
    }
  ): Promise<boolean> {
    const policy = await tx.policy.findUnique({
      where: {
        poolId_agentAddress_policyType: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          policyType: data.policyType,
        },
      },
    });
    if (!policy) return false;

    await tx.policy.update({
      where: {
        poolId_agentAddress_policyType: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          policyType: data.policyType,
        },
      },
      data: {
        configHash: data.configHash,
        marketplaceId: data.marketplaceId,
        updatedAt: data.updatedAt,
      },
    });
    return true;
  }

  /**
   * Removes policy binding (sets status = 'removed').
   * Requirement: 4.3
   */
  async removePolicy(
    tx: TransactionClient,
    poolId: string,
    agentAddress: string,
    policyType: string,
    removedAt: Date
  ): Promise<boolean> {
    const policy = await tx.policy.findUnique({
      where: {
        poolId_agentAddress_policyType: {
          poolId,
          agentAddress,
          policyType,
        },
      },
    });
    if (!policy) return false;

    await tx.policy.update({
      where: {
        poolId_agentAddress_policyType: {
          poolId,
          agentAddress,
          policyType,
        },
      },
      data: {
        status: 'removed',
        removedAt,
      },
    });
    return true;
  }

  /**
   * Inserts an action proposal on ActionProposedEvent.
   * Requirement: 5.1, 5.5
   */
  async insertActionProposed(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      nonce: bigint;
      kind: string;
      amountIn: Prisma.Decimal;
      minAmountOut: Prisma.Decimal;
      proposedAt: Date;
    }
  ): Promise<boolean> {
    // Check if duplicate action nonce exists
    const action = await tx.action.findUnique({
      where: {
        poolId_agentAddress_nonce: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          nonce: data.nonce,
        },
      },
    });

    if (action) {
      if (action.status === 'proposed') {
        // Skip duplicate proposed action (Requirement 5.5)
        return false;
      }
      // If it exists but is 'settled' (e.g. out-of-order backfilled), do not re-insert.
      return true;
    }

    // Insert new action
    await tx.action.create({
      data: {
        poolId: data.poolId,
        agentAddress: data.agentAddress,
        nonce: data.nonce,
        kind: data.kind,
        amountIn: data.amountIn,
        minAmountOut: data.minAmountOut,
        status: 'proposed',
        proposedAt: data.proposedAt,
      },
    });

    // Increment agent action_count
    await tx.agent.update({
      where: {
        poolId_agentAddress: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
        },
      },
      data: {
        actionCount: { increment: 1 },
      },
    });

    return true;
  }

  /**
   * Updates an action when settled on ActionSettledEvent.
   * Returns false if action was not found.
   * Requirement: 5.2
   */
  async updateActionSettled(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      nonce: bigint;
      quotedAmountOut: Prisma.Decimal;
      settlementStatus: number;
      settledAt: Date;
    }
  ): Promise<boolean> {
    const action = await tx.action.findUnique({
      where: {
        poolId_agentAddress_nonce: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          nonce: data.nonce,
        },
      },
    });

    if (!action) return false;

    // Update existing action
    await tx.action.update({
      where: {
        poolId_agentAddress_nonce: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
          nonce: data.nonce,
        },
      },
      data: {
        quotedAmountOut: data.quotedAmountOut,
        settlementStatus: data.settlementStatus,
        settledAt: data.settledAt,
        status: 'settled',
      },
    });

    // Update agent last_active_at
    await tx.agent.update({
      where: {
        poolId_agentAddress: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
        },
      },
      data: {
        lastActiveAt: data.settledAt,
      },
    });

    return true;
  }

  /**
   * Backfills a settled action record when no proposal exists.
   * Requirement: 5.3, 5.4
   */
  async backfillActionSettled(
    tx: TransactionClient,
    data: {
      poolId: string;
      agentAddress: string;
      nonce: bigint;
      kind: string;
      amountIn: Prisma.Decimal;
      minAmountOut: Prisma.Decimal;
      quotedAmountOut: Prisma.Decimal;
      settlementStatus: number;
      settledAt: Date;
    }
  ): Promise<void> {
    await tx.action.create({
      data: {
        poolId: data.poolId,
        agentAddress: data.agentAddress,
        nonce: data.nonce,
        kind: data.kind,
        amountIn: data.amountIn,
        minAmountOut: data.minAmountOut,
        quotedAmountOut: data.quotedAmountOut,
        settlementStatus: data.settlementStatus,
        status: 'settled',
        proposedAt: null,
        settledAt: data.settledAt,
      },
    });

    // Update agent last_active_at
    await tx.agent.update({
      where: {
        poolId_agentAddress: {
          poolId: data.poolId,
          agentAddress: data.agentAddress,
        },
      },
      data: {
        lastActiveAt: data.settledAt,
      },
    });
  }

  /**
   * Inserts raw event payload to event_logs table.
   * Requirement: 2.5, 3.1, 4.4, 5.1
   */
  async insertEventLog(
    tx: TransactionClient,
    data: {
      eventType: string;
      poolId: string;
      agentAddress: string | null;
      nonce: bigint | null;
      txDigest: string;
      checkpointSeq: bigint;
      timestamp: Date;
      rawPayload: any;
    }
  ): Promise<void> {
    await tx.eventLog.create({
      data: {
        eventType: data.eventType,
        poolId: data.poolId,
        agentAddress: data.agentAddress,
        nonce: data.nonce,
        txDigest: data.txDigest,
        checkpointSeq: data.checkpointSeq,
        timestamp: data.timestamp,
        rawPayload: data.rawPayload,
      },
    });
  }
}
