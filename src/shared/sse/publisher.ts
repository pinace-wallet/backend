/**
 * In-memory pub/sub for Server-Sent Events.
 *
 * Indexer event processors publish() after a write lands; HTTP /stream
 * route subscribes per-connection and forwards matching events. No
 * external broker (Redis/NATS) — fine for a single-node deploy. If we
 * scale horizontally later, swap the body of publish/subscribe for a
 * Redis pub/sub channel with the same interface.
 *
 * Event payload shape kept intentionally flat so the client can switch
 * on `kind` and patch its react-query cache without re-querying.
 */

export type SseEventKind =
  | 'pool_created'
  | 'pool_deposit'
  | 'pool_withdraw'
  | 'agent_connected'
  | 'agent_revoked'
  | 'policy_attached'
  | 'policy_updated'
  | 'policy_removed'
  | 'action_proposed'
  | 'action_settled';

export interface SsePayload {
  kind: SseEventKind;
  /** Owner address (lower-case) — clients filter on this. */
  owner?: string;
  /** Pool object id — clients filter on this for pool-scoped UI. */
  poolId?: string;
  /** Agent address — clients filter on this for agent-scoped UI. */
  agentAddress?: string;
  /** ISO timestamp at publish time (ms precision). */
  ts: number;
  /** Free-form context the indexer wants to forward (digest, amounts, etc.). */
  data?: Record<string, unknown>;
}

export type SseSubscriber = (event: SsePayload) => void;

export class SsePublisher {
  private subscribers = new Set<SseSubscriber>();

  /** Add a listener; returns the unsubscribe fn. */
  subscribe(fn: SseSubscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  publish(event: SsePayload): void {
    // Snapshot to avoid mutation-during-iteration if a subscriber
    // unsubscribes mid-fan-out.
    for (const fn of [...this.subscribers]) {
      try {
        fn(event);
      } catch (err) {
        // Subscriber bug should not kill the publish loop.
        // eslint-disable-next-line no-console
        console.error('[sse] subscriber threw', err);
      }
    }
  }

  size(): number {
    return this.subscribers.size;
  }
}

/** Singleton — both indexer and api modules import this same instance. */
export const ssePublisher = new SsePublisher();
