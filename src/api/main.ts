import { loadConfig } from '../shared/config.js';
import { getPrismaClient, runMigrations } from '../shared/db/client.js';
import { buildApp, startServer } from './server.js';

async function main() {
  console.info('[api] Starting REST API Server...');

  // 1. Load configuration
  const config = loadConfig();

  // 2. Run migrations
  await runMigrations(config.databaseUrl);

  // 3. Connect to database
  const prisma = getPrismaClient(config.databaseUrl);

  // 4. Build Fastify app
  const app = buildApp(config, prisma);

  // 5. Handle graceful shutdown
  const shutdown = () => {
    console.info('[api] Shutting down Fastify server...');
    app.close().then(() => {
      prisma.$disconnect().then(() => {
        console.info('[api] Database disconnected. Exiting.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // 6. Start listening
  try {
    const address = await startServer(app, config.port);
    console.info(`[api] Fastify server listening at ${address}`);
  } catch (err) {
    console.error('[api] Failed to start server:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[api] Fatal error in API server:', err);
  process.exit(1);
});
