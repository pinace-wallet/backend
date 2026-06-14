/**
 * One-shot script: for every Policy row, read the on-chain Config and
 * persist it to policies.config. Safe to re-run — already-populated rows
 * just get re-read, which is also useful after PolicyUpdated events were
 * missed.
 *
 * Run:
 *   pnpm tsx src/scripts/backfill-policy-config.ts
 */

import { loadConfig } from '../shared/config.js';
import { getPrismaClient } from '../shared/db/client.js';
import { SuiClientWrapper } from '../shared/sui/client.js';
import { Prisma } from '@prisma/client';

async function main() {
  const cfg = loadConfig();
  const prisma = getPrismaClient(cfg.databaseUrl);
  const sui = new SuiClientWrapper(cfg.suiRpcUrl, cfg.packageId);

  const rows = await prisma.policy.findMany({
    where: { status: 'attached' },
    select: { id: true, poolId: true, agentAddress: true, policyType: true },
  });
  console.log(`[backfill] ${rows.length} attached policies to refresh`);

  let ok = 0;
  let missed = 0;
  // Limit concurrency to avoid hammering the RPC.
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const i = cursor++;
      const row = rows[i];
      try {
        const config = await sui.readPolicyConfig(row.poolId, row.agentAddress, row.policyType);
        await prisma.policy.update({
          where: { id: row.id },
          data: { config: config === null ? Prisma.JsonNull : (config as Prisma.InputJsonValue) },
        });
        if (config) ok++;
        else missed++;
      } catch (e) {
        missed++;
        console.warn('[backfill] failed', row.id, (e as Error).message);
      }
      if ((i + 1) % 25 === 0) console.log(`[backfill] ${i + 1}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log(`[backfill] done. ok=${ok} missed=${missed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
