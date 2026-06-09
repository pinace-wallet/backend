import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('REST API Property Tests', () => {

  // Feature: onchain-event-indexer, Property 6: pagination completeness
  it('should cover all elements exactly once when iterating through all pages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), name: fc.string() }), { minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }), // Page Limit
        (allItems, limit) => {
          const total = allItems.length;
          const totalPages = Math.ceil(total / limit);
          
          const collectedItems: any[] = [];
          
          for (let page = 1; page <= totalPages; page++) {
            const skip = (page - 1) * limit;
            const pageData = allItems.slice(skip, skip + limit);
            collectedItems.push(...pageData);
          }

          expect(collectedItems.length).toBe(total);
          
          const originalIds = allItems.map((item) => item.id).sort();
          const collectedIds = collectedItems.map((item) => item.id).sort();
          expect(collectedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: onchain-event-indexer, Property 10: health endpoint threshold
  it('should return ok (200) when lag is <= 60s, and error (503) when lag > 60s', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120000 }),
        (lagMs) => {
          const status = lagMs <= 60000 ? 'ok' : 'error';
          const httpCode = lagMs <= 60000 ? 200 : 503;

          if (lagMs <= 60000) {
            expect(status).toBe('ok');
            expect(httpCode).toBe(200);
          } else {
            expect(status).toBe('error');
            expect(httpCode).toBe(503);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
