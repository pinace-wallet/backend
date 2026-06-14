import { PrismaClient } from '@prisma/client';
import { SuiClientWrapper, RawSuiEvent } from '../../shared/sui/client.js';
import { EventProcessor } from '../processor/index.js';
import { IndexerRepository } from '../repository/indexer.repository.js';

export class PollingLoop {
  private suiClient: SuiClientWrapper;
  private processor: EventProcessor;
  private repo: IndexerRepository;
  private prisma: PrismaClient;
  private pollIntervalMs: number;
  private batchSize: number;
  private active: boolean;
  private timeoutId: NodeJS.Timeout | null;
  private lastCheckpointUpdatedAt: Date | null;

  constructor(
    suiClient: SuiClientWrapper,
    processor: EventProcessor,
    repo: IndexerRepository,
    prisma: PrismaClient,
    pollIntervalMs: number,
    batchSize: number
  ) {
    this.suiClient = suiClient;
    this.processor = processor;
    this.repo = repo;
    this.prisma = prisma;
    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
    this.active = false;
    this.timeoutId = null;
    this.lastCheckpointUpdatedAt = null;
  }

  /**
   * Starts the polling loop.
   * Requirement: 1.2, 1.4
   */
  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    console.info('[polling] Starting event polling loop...');
    
    // Begin the loop
    this.poll();
  }

  /**
   * Stops the polling loop.
   */
  stop(): void {
    this.active = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    console.info('[polling] Polling loop stopped');
  }

  /**
   * Gets the timestamp when the checkpoint was last updated in memory.
   * Requirement: 9.3
   */
  getLastCheckpointUpdatedAt(): Date | null {
    return this.lastCheckpointUpdatedAt;
  }

  /**
   * Primary polling iteration.
   * Requirement: 1.2, 1.4, 1.6, 1.8
   */
  private async poll(): Promise<void> {
    if (!this.active) return;

    try {
      // 1. Get the last checkpoint sequence from the database
      const lastSeq = await this.repo.getCheckpoint(this.prisma);
      let cursor: string | null = null;

      if (lastSeq !== null && lastSeq > 0n) {
        // The maxSeqInBatch stored in checkpoints is a synthetic monotonic
        // counter (lastSeq + 1 per batch), not Sui's real checkpoint
        // sequence — so on restart the saved value rarely matches any
        // event_logs.checkpointSeq. First try the original lookup, then
        // fall back to "whatever event we stored most recently" so
        // queryEvents resumes from the right point instead of restarting
        // from the beginning of history (which causes the loop to spin
        // marking every page as already-processed).
        const exactMatch = await this.prisma.eventLog.findFirst({
          where: { checkpointSeq: lastSeq },
          orderBy: { timestamp: 'desc' },
        });
        const lastEvent =
          exactMatch ??
          (await this.prisma.eventLog.findFirst({
            orderBy: [{ checkpointSeq: 'desc' }, { timestamp: 'desc' }],
          }));

        if (lastEvent) {
          const payload = lastEvent.rawPayload as any;
          if (payload && payload.id) {
            cursor = JSON.stringify(payload.id);
          }
        }
      }

      // 2. Query events from Sui
      const page = await this.suiClient.queryEvents(cursor, this.batchSize);

      if (page.events.length > 0) {
        // 3. Process events in an atomic transaction with retry logic (up to 3 times)
        let processed = false;
        let attempts = 0;
        const maxDbAttempts = 3;

        while (!processed && attempts < maxDbAttempts) {
          try {
            attempts++;
            await this.prisma.$transaction(async (tx) => {
              // Get the highest checkpoint sequence in this batch of events
              let maxSeqInBatch = lastSeq || 0n;
              for (const e of page.events) {
                // In standard Sui event structures, the event id contains txDigest & eventSeq,
                // and the event envelope may contain a checkpoint sequence.
                // We'll read the checkpoint sequence from the event if available, or default to incrementing.
                const seq = e.id.eventSeq ? BigInt(e.id.eventSeq) : 0n; // fallback
                // Sui events returned by SDK have a checkpoint number if available,
                // let's look for checkpoint or construct a monotonic sequence.
                // In practice, we can parse eventSeq or extract from timestamp.
                // For safety and monotonicity:
                const eventCheckpoint = (e as any).checkpoint ? BigInt((e as any).checkpoint) : (maxSeqInBatch + 1n);
                if (eventCheckpoint > maxSeqInBatch) {
                  maxSeqInBatch = eventCheckpoint;
                }
              }

              // Process events
              await this.processor.processBatch(page.events, tx, maxSeqInBatch);

              // Update checkpoint sequence
              await this.repo.upsertCheckpoint(tx, maxSeqInBatch);
            });

            processed = true;
            this.lastCheckpointUpdatedAt = new Date();
            console.info(`[polling] Successfully processed batch of ${page.events.length} events`);
          } catch (dbError) {
            console.error(`[polling] Database write failed (attempt ${attempts}/${maxDbAttempts}):`, dbError);
            if (attempts >= maxDbAttempts) {
              console.error('[polling] DB write attempts exhausted. Exiting process.');
              process.exit(1);
            }
            // Wait 500ms before retrying DB transaction
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        // Empty batch, nothing to do
        console.debug('[polling] No new events found');
      }

    } catch (error) {
      console.error('[polling] Error in polling loop iteration:', error);
    }

    // Schedule next iteration
    if (this.active) {
      this.timeoutId = setTimeout(() => this.poll(), this.pollIntervalMs);
    }
  }
}
