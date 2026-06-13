/**
 * Generates openapi.ts at the backend root.
 * Usage: npm run generate:openapi
 *
 * Boots the Fastify app with dummy env (no DB queries happen during ready()),
 * extracts the spec via app.swagger(), then writes a typed TS export.
 */

// Provide dummy env vars so loadConfig() doesn't exit
process.env.SUI_RPC_URL = 'https://fullnode.mainnet.sui.io:443';
process.env.PACKAGE_ID = '0x' + '0'.repeat(64);
process.env.DATABASE_URL = 'postgresql://localhost/pinace_openapi_gen';

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../shared/config.js';
import { buildApp } from '../api/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = loadConfig();
// Prisma only connects on first query — safe to create without a real DB here
const prisma = new PrismaClient();

const app = buildApp(config, prisma);
await app.ready();

const spec = app.swagger();
await app.close();

const outputPath = resolve(__dirname, '../../openapi.ts');
const content = `\
// ============================================================
// AUTO-GENERATED — do not edit manually.
// Run \`npm run generate:openapi\` to regenerate.
// ============================================================

export const openapi = ${JSON.stringify(spec, null, 2)} as const;

export type OpenAPISpec = typeof openapi;
`;

writeFileSync(outputPath, content, 'utf8');
console.log(`✓ openapi.ts written to ${outputPath}`);
