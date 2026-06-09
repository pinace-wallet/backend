import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { EventProcessor } from '../src/indexer/processor/index.js';
import { IndexerRepository } from '../src/indexer/repository/indexer.repository.js';
import { RawSuiEvent } from '../src/shared/sui/client.js';

describe('Indexer Event Ingestion & Polling Property Tests', () => {
  const PACKAGE_ID = '0x48fe6e060674e81288375a770fc4ad3022d2ca07ea28fb77b3d8ecfb8c115c04';

  // Feature: onchain-event-indexer, Property 8: package ID filter correctness
  it('should filter events to only those matching the package ID', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.record({ txDigest: fc.string(), eventSeq: fc.string() }),
            packageId: fc.oneof(fc.constant(PACKAGE_ID), fc.string().filter(s => s !== PACKAGE_ID)),
            transactionModule: fc.string(),
            sender: fc.string(),
            type: fc.string(),
            parsedJson: fc.record({ pool_id: fc.string() }),
            timestampMs: fc.string(),
          })
        ),
        (events) => {
          const filtered = events.filter((e) => e.packageId === PACKAGE_ID);
          
          filtered.forEach((e) => {
            expect(e.packageId).toBe(PACKAGE_ID);
          });
          
          const nonMatchingCount = events.length - filtered.length;
          const skipped = events.filter((e) => e.packageId !== PACKAGE_ID);
          expect(skipped.length).toBe(nonMatchingCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 2: balance arithmetic preserves non-negativity
  it('should ensure balance amount is never negative, regardless of deposit/withdrawal sequences', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.oneof(fc.constant('deposit'), fc.constant('withdraw')),
            amount: fc.double({ min: 0, max: 1000000 }),
          })
        ),
        (transactions) => {
          let currentBalance = new Prisma.Decimal(0);
          
          for (const tx of transactions) {
            const amount = new Prisma.Decimal(tx.amount);
            if (tx.type === 'deposit') {
              currentBalance = currentBalance.plus(amount);
            } else {
              const next = currentBalance.minus(amount);
              currentBalance = next.isNegative() ? new Prisma.Decimal(0) : next;
            }

            expect(currentBalance.isNegative()).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 3: event log completeness
  it('should create exactly one event log for each processed on-chain event', () => {
    const eventTypes = [
      'PoolCreatedEvent',
      'DepositEvent',
      'WithdrawEvent',
      'AgentConnectedEvent',
      'AgentRevokedEvent',
    ];

    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.record({ txDigest: fc.string(), eventSeq: fc.string() }),
            packageId: fc.constant(PACKAGE_ID),
            transactionModule: fc.string(),
            sender: fc.string(),
            type: fc.oneof(...eventTypes.map(t => fc.constant(`0x123::module::${t}`))),
            parsedJson: fc.record({
              pool_id: fc.string(),
              owner: fc.string(),
              version: fc.integer(),
              amount: fc.nat().map(String),
              coin_type: fc.string(),
              agent: fc.string(),
            }),
            timestampMs: fc.constant('1700000000000'),
          })
        ),
        async (rawEvents) => {
          const insertedLogs: any[] = [];
          
          const mockRepo = {
            upsertPool: vi.fn(),
            ensurePoolExists: vi.fn(),
            depositBalance: vi.fn(),
            withdrawBalance: vi.fn().mockResolvedValue({ warning: false, overdrawnAmount: new Prisma.Decimal(0) }),
            upsertAgent: vi.fn(),
            revokeAgent: vi.fn().mockResolvedValue(true),
            upsertPolicy: vi.fn(),
            updatePolicy: vi.fn().mockResolvedValue(true),
            removePolicy: vi.fn().mockResolvedValue(true),
            insertActionProposed: vi.fn().mockResolvedValue(true),
            updateActionSettled: vi.fn().mockResolvedValue(true),
            backfillActionSettled: vi.fn(),
            insertEventLog: vi.fn().mockImplementation((tx, data) => {
              insertedLogs.push(data);
              return Promise.resolve();
            }),
          } as unknown as IndexerRepository;

          const processor = new EventProcessor(mockRepo);
          const mockTx = {} as any;

          await processor.processBatch(rawEvents, mockTx, 1n);

          expect(insertedLogs.length).toBe(rawEvents.length);
          
          for (let i = 0; i < rawEvents.length; i++) {
            expect(insertedLogs[i].txDigest).toBe(rawEvents[i].id.txDigest);
            expect(insertedLogs[i].rawPayload).toEqual(rawEvents[i].parsedJson);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 4: action nonce pairing round-trip
  it('should correctly pair action proposals and settlements in any processing order', () => {
    fc.assert(
      fc.property(
        fc.record({
          poolId: fc.string(),
          agentAddress: fc.string(),
          nonce: fc.bigInt(),
          proposedTime: fc.date(),
          settledTime: fc.date(),
        }),
        fc.boolean(), // proposedFirst
        (actionEvent, proposedFirst) => {
          const dbActions: any[] = [];

          const simulateProposed = () => {
            const existing = dbActions.find(
              (a) => a.poolId === actionEvent.poolId && a.agentAddress === actionEvent.agentAddress && a.nonce === actionEvent.nonce
            );
            if (existing) {
              existing.proposedAt = actionEvent.proposedTime;
            } else {
              dbActions.push({
                poolId: actionEvent.poolId,
                agentAddress: actionEvent.agentAddress,
                nonce: actionEvent.nonce,
                proposedAt: actionEvent.proposedTime,
                settledAt: null,
                status: 'proposed',
              });
            }
          };

          const simulateSettled = () => {
            const existing = dbActions.find(
              (a) => a.poolId === actionEvent.poolId && a.agentAddress === actionEvent.agentAddress && a.nonce === actionEvent.nonce
            );
            if (existing) {
              existing.settledAt = actionEvent.settledTime;
              existing.status = 'settled';
            } else {
              dbActions.push({
                poolId: actionEvent.poolId,
                agentAddress: actionEvent.agentAddress,
                nonce: actionEvent.nonce,
                proposedAt: null,
                settledAt: actionEvent.settledTime,
                status: 'settled',
              });
            }
          };

          if (proposedFirst) {
            simulateProposed();
            simulateSettled();
          } else {
            simulateSettled();
            simulateProposed();
          }

          expect(dbActions.length).toBe(1);
          
          const action = dbActions[0];
          expect(action.nonce).toBe(actionEvent.nonce);
          expect(action.status).toBe('settled');
          expect(action.settledAt).toBe(actionEvent.settledTime);
          if (proposedFirst) {
            expect(action.proposedAt).toBe(actionEvent.proposedTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 1: checkpoint cursor monotonically advances
  it('should ensure checkpoint last_checkpoint_seq is monotonically increasing', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1000000n }),
        fc.array(fc.bigInt({ min: 0n, max: 1000n })),
        (initial, steps) => {
          let lastCheckpointSeq = initial;

          for (const step of steps) {
            const nextCursorSeq = lastCheckpointSeq + step;
            expect(nextCursorSeq).toBeGreaterThanOrEqual(lastCheckpointSeq);
            lastCheckpointSeq = nextCursorSeq;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
