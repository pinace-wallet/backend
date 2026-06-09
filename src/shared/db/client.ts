import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type PrismaDb = PrismaClient;

let prismaInstance: PrismaClient | null = null;

/**
 * Returns a singleton instance of PrismaClient.
 */
export function getPrismaClient(databaseUrl: string): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['error', 'warn'],
    });
  }
  return prismaInstance;
}

/**
 * Runs pending database migrations using Prisma CLI.
 * Exits with process code 1 if any migration fails.
 * Requirement: 9.4
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  console.info('[db] Running database migrations...');
  try {
    // Execute prisma migrate deploy to run pending migrations
    // Inject DATABASE_URL so it runs against the correct DB
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.info('[db] Migrations applied successfully');
  } catch (err) {
    console.error('[db] Migration failed:', err);
    process.exit(1);
  }
}
