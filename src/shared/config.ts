import { z } from 'zod';

// ─── AppConfig interface ────────────────────────────────────────────────────

export interface AppConfig {
  suiRpcUrl: string;
  packageId: string;
  databaseUrl: string;
  pollIntervalMs: number; // default 2000, range 1000–60000
  batchSize: number;      // default 50,   range 1–200
  port: number;           // default 3001, range 1024–65535
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // default 'info'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a Zod preprocessor for optional integer env vars that:
 *  1. Coerces the raw string value to a number.
 *  2. Validates it is an integer.
 *  3. If it falls outside [min, max], logs a warning and substitutes
 *     the default value so the schema parse does NOT throw.
 *
 * Requirement 9.6: out-of-range optional numeric → warn + use default.
 */
function optionalIntWithRangeDefault(
  envKey: string,
  min: number,
  max: number,
  defaultValue: number,
): z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown> {
  return z
    .preprocess(
      (raw) => {
        if (raw === undefined || raw === null || raw === '') return undefined;
        const n = Number(raw);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          return raw;
        }
        if (n < min || n > max) {
          console.warn(
            `[config] ${envKey}=${n} is out of range [${min}, ${max}]. ` +
              `Using default value ${defaultValue}.`,
          );
          return undefined; // triggers Zod .default()
        }
        return n;
      },
      z.number().int().default(defaultValue),
    ) as z.ZodEffects<z.ZodDefault<z.ZodNumber>, number, unknown>;
}

// ─── Zod schema ─────────────────────────────────────────────────────────────

const envSchema = z.object({
  SUI_RPC_URL: z
    .string({ required_error: 'SUI_RPC_URL is required' })
    .url('SUI_RPC_URL must be a valid URL'),

  PACKAGE_ID: z
    .string({ required_error: 'PACKAGE_ID is required' })
    .regex(
      /^0x[0-9a-fA-F]{64}$/,
      'PACKAGE_ID must be a 0x-prefixed 64-character hex string',
    ),

  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL must not be empty'),

  POLL_INTERVAL_MS: optionalIntWithRangeDefault('POLL_INTERVAL_MS', 1000, 60000, 2000),
  BATCH_SIZE:       optionalIntWithRangeDefault('BATCH_SIZE',       1,    200,   50),
  PORT:             optionalIntWithRangeDefault('PORT',             1024, 65535, 3001),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

// ─── loadConfig ─────────────────────────────────────────────────────────────

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const varName = issue.path[0] ?? 'unknown';
      console.error(
        `[config] Validation failed for ${varName}: ${issue.message}`,
      );
    }
    process.exit(1);
  }

  const env = result.data;

  return {
    suiRpcUrl:      env.SUI_RPC_URL,
    packageId:      env.PACKAGE_ID,
    databaseUrl:    env.DATABASE_URL,
    pollIntervalMs: env.POLL_INTERVAL_MS,
    batchSize:      env.BATCH_SIZE,
    port:           env.PORT,
    logLevel:       env.LOG_LEVEL,
  };
}
