-- Denormalize on-chain policy Config values into the indexer.
-- Source: Move Bag<TypeName, Config> on Delegation.configs.
-- See: src/shared/sui/client.ts readPolicyConfig() + src/indexer/processor/policy.ts.
ALTER TABLE "policies" ADD COLUMN "config" JSONB;
