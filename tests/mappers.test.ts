import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapKind, mapMilestoneStatus, mapRunStatus } from '../src/shared/mappers.js';

describe('Shared Mappers Property Tests', () => {
  
  // Feature: onchain-event-indexer, Property 7: kind and status integer mapping totality
  it('should map any integer kind to exactly swap, withdraw, deposit, or unknown', () => {
    fc.assert(
      fc.property(fc.integer(), (kindInt) => {
        const kindStr = mapKind(kindInt);
        
        if (kindInt === 1) {
          expect(kindStr).toBe('swap');
        } else if (kindInt === 2) {
          expect(kindStr).toBe('withdraw');
        } else if (kindInt === 3) {
          expect(kindStr).toBe('deposit');
        } else {
          expect(kindStr).toBe('unknown');
        }
        
        expect(['swap', 'withdraw', 'deposit', 'unknown']).toContain(kindStr);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 9: milestone status mapping correctness
  it('should map milestones correctly to success, reverted, or pending', () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.oneof(fc.constant('proposed'), fc.constant('settled')),
          settlementStatus: fc.oneof(fc.constant(1), fc.integer({ min: -100, max: 100 }).filter(v => v !== 1), fc.constant(null)),
        }),
        (action) => {
          const milestoneStatus = mapMilestoneStatus(action);
          
          if (action.status === 'proposed') {
            expect(milestoneStatus).toBe('pending');
          } else if (action.settlementStatus === 1) {
            expect(milestoneStatus).toBe('success');
          } else {
            expect(milestoneStatus).toBe('reverted');
          }
          
          expect(['success', 'reverted', 'pending']).toContain(milestoneStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 5: agent run_status correctness
  it('should compute agent run_status correctly based on actions list', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.oneof(fc.constant('proposed'), fc.constant('settled')),
            settlementStatus: fc.oneof(fc.constant(1), fc.integer({ min: -10, max: 10 }).filter(v => v !== 1), fc.constant(null)),
          })
        ),
        (actions) => {
          const runStatus = mapRunStatus(actions);

          if (actions.length === 0) {
            expect(runStatus).toBe('idle');
          } else {
            const hasProposed = actions.some((a) => a.status === 'proposed');
            const allSettledSuccess = actions.every((a) => a.status === 'settled' && a.settlementStatus === 1);

            if (hasProposed) {
              expect(runStatus).toBe('running');
            } else if (allSettledSuccess) {
              expect(runStatus).toBe('done');
            } else {
              expect(runStatus).toBe('idle');
            }
          }

          expect(['running', 'done', 'idle']).toContain(runStatus);
        }
      ),
      { numRuns: 100 }
    );
  });
});
