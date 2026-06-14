import { loadConfig } from '../shared/config.js';
import { getPrismaClient, runMigrations } from '../shared/db/client.js';
import { SuiClientWrapper } from '../shared/sui/client.js';
import { IndexerRepository } from './repository/indexer.repository.js';
import { EventProcessor } from './processor/index.js';
import { PollingLoop } from './polling/loop.js';

async function main() {
  console.info('[indexer] Starting Pinace Event Indexer Worker...');

  // 1. Load configuration
  const config = loadConfig();

  // 2. Run database migrations
  await runMigrations(config.databaseUrl);

  // 3. Connect to database
  const prisma = getPrismaClient(config.databaseUrl);

  // 4. Initialize components
  const suiClient = new SuiClientWrapper(config.suiRpcUrl, config.packageId);
  const repo = new IndexerRepository();
  const processor = new EventProcessor(repo, suiClient);
  const pollingLoop = new PollingLoop(
    suiClient,
    processor,
    repo,
    prisma,
    config.pollIntervalMs,
    config.batchSize
  );

  // 5. Handle graceful shutdown
  const shutdown = () => {
    console.info('[indexer] Shutting down gracefully...');
    pollingLoop.stop();
    prisma.$disconnect().then(() => {
      console.info('[indexer] Database disconnected. Exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // 6. Start polling
  await pollingLoop.start();
}

main().catch((err) => {
  console.error('[indexer] Fatal error in worker:', err);
  process.exit(1);
});
