import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { loadConfig } from '../src/shared/config.js';

describe('AppConfig Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      SUI_RPC_URL: 'https://fullnode.testnet.sui.io:443',
      PACKAGE_ID: '0x48fe6e060674e81288375a770fc4ad3022d2ca07ea28fb77b3d8ecfb8c115c04',
      DATABASE_URL: 'postgresql://pinace:secret@localhost:5432/pinace_indexer',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Feature: onchain-event-indexer, Property 7 (config variant): out-of-range optional uses default
  it('should fall back to defaults when optional numeric env variables are out of range', () => {
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 999 }),      // POLL_INTERVAL_MS min is 1000
          fc.integer({ min: 60001, max: 100000 })
        ),
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),         // BATCH_SIZE min is 1
          fc.integer({ min: 201, max: 1000 })
        ),
        fc.oneof(
          fc.integer({ min: -100, max: 1023 }),      // PORT min is 1024
          fc.integer({ min: 65536, max: 100000 })
        ),
        (badPoll, badBatch, badPort) => {
          process.env.POLL_INTERVAL_MS = String(badPoll);
          process.env.BATCH_SIZE = String(badBatch);
          process.env.PORT = String(badPort);

          const config = loadConfig();

          expect(config.pollIntervalMs).toBe(2000);
          expect(config.batchSize).toBe(50);
          expect(config.port).toBe(3001);
          expect(spyWarn).toHaveBeenCalled();

          spyWarn.mockClear();
        }
      ),
      { numRuns: 100 }
    );

    spyWarn.mockRestore();
  });
});
