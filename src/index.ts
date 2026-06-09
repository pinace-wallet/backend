import { loadConfig } from './shared/config.js';
import { getPrismaClient, runMigrations } from './shared/db/client.js';
import { SuiClientWrapper } from './shared/sui/client.js';
import { IndexerRepository } from './indexer/repository/indexer.repository.js';
import { EventProcessor } from './indexer/processor/index.js';
import { PollingLoop } from './indexer/polling/loop.js';
import { buildApp, startServer } from './api/server.js';

/**
 * Root entry point for Pinace Backend.
 * Bootstraps both services concurrently in the same process for local development.
 * In production, they can be run independently using src/api/main.ts and src/indexer/main.ts.
 */
async function main() {
  console.info('[backend] Bootstrapping REST API and Event Indexer concurrently...');

  // 1. Load configuration
  const config = loadConfig();

  // 2. Run migrations once before starting services
  await runMigrations(config.databaseUrl);

  // 3. Connect to database
  const prisma = getPrismaClient(config.databaseUrl);

  // 4. Start REST API Server
  const app = buildApp(config, prisma);
  try {
    const address = await startServer(app, config.port);
    console.info(`[api] Fastify server listening at ${address}`);
  } catch (err) {
    console.error('[api] Failed to start Fastify server:', err);
    process.exit(1);
  }

  // 5. Start Indexer Polling Loop
  const suiClient = new SuiClientWrapper(config.suiRpcUrl, config.packageId);
  const repo = new IndexerRepository();
  const processor = new EventProcessor(repo);
  const pollingLoop = new PollingLoop(
    suiClient,
    processor,
    repo,
    prisma,
    config.pollIntervalMs,
    config.batchSize
  );

  // 6. Graceful shutdown
  const shutdown = () => {
    console.info('[backend] Shutting down services gracefully...');
    pollingLoop.stop();
    app.close().then(() => {
      prisma.$disconnect().then(() => {
        console.info('[backend] Services stopped. Database disconnected.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // 7. Start polling
  await pollingLoop.start();
}

main().catch((err) => {
  console.error('[backend] Fatal error on root bootstrap:', err);
  process.exit(1);
});
