-- CreateTable
CREATE TABLE "pools" (
    "pool_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "protocol_version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("pool_id")
);

-- CreateTable
CREATE TABLE "pool_balances" (
    "pool_id" TEXT NOT NULL,
    "coin_type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_balances_pkey" PRIMARY KEY ("pool_id","coin_type")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "pool_id" TEXT NOT NULL,
    "agent_address" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_ms" BIGINT NOT NULL DEFAULT 0,
    "connected_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "action_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMPTZ,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "pool_id" TEXT NOT NULL,
    "agent_address" TEXT NOT NULL,
    "policy_type" TEXT NOT NULL,
    "config_hash" TEXT,
    "marketplace_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'attached',
    "attached_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "pool_id" TEXT NOT NULL,
    "agent_address" TEXT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'unknown',
    "amount_in" DECIMAL NOT NULL DEFAULT 0,
    "min_amount_out" DECIMAL NOT NULL DEFAULT 0,
    "quoted_amount_out" DECIMAL,
    "settlement_status" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "proposed_at" TIMESTAMPTZ,
    "settled_at" TIMESTAMPTZ,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "agent_address" TEXT,
    "nonce" BIGINT,
    "tx_digest" TEXT NOT NULL,
    "checkpoint_seq" BIGINT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "raw_payload" JSONB NOT NULL,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_checkpoint_seq" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_pools_owner" ON "pools"("owner");

-- CreateIndex
CREATE INDEX "idx_agents_pool_id" ON "agents"("pool_id");

-- CreateIndex
CREATE INDEX "idx_agents_agent_address" ON "agents"("agent_address");

-- CreateIndex
CREATE UNIQUE INDEX "uq_agents_pool_agent" ON "agents"("pool_id", "agent_address");

-- CreateIndex
CREATE UNIQUE INDEX "uq_policies_pool_agent_type" ON "policies"("pool_id", "agent_address", "policy_type");

-- CreateIndex
CREATE INDEX "idx_actions_pool_id" ON "actions"("pool_id");

-- CreateIndex
CREATE INDEX "idx_actions_agent_address" ON "actions"("agent_address");

-- CreateIndex
CREATE UNIQUE INDEX "uq_actions_pool_agent_nonce" ON "actions"("pool_id", "agent_address", "nonce");

-- CreateIndex
CREATE INDEX "idx_event_logs_pool_id" ON "event_logs"("pool_id");

-- CreateIndex
CREATE INDEX "idx_event_logs_agent_address" ON "event_logs"("agent_address");

-- CreateIndex
CREATE INDEX "idx_event_logs_tx_digest" ON "event_logs"("tx_digest");

-- AddForeignKey
ALTER TABLE "pool_balances" ADD CONSTRAINT "pool_balances_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("pool_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("pool_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("pool_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("pool_id") ON DELETE CASCADE ON UPDATE CASCADE;
