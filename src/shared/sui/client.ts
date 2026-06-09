import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

export interface RawSuiEvent {
  id: { txDigest: string; eventSeq: string };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: Record<string, any>;
  timestampMs: string;
  checkpoint?: string;
}

export interface SuiEventPage {
  events: RawSuiEvent[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export class SuiClientWrapper {
  private client: SuiClient;
  private packageId: string;

  constructor(rpcUrl: string, packageId: string) {
    this.client = new SuiClient({ url: rpcUrl });
    this.packageId = packageId;
  }

  /**
   * Queries events from the blockchain.
   * Filters events to packageId and implements transient retry logic.
   * Requirements: 1.1, 1.3, 1.5, 1.7
   */
  async queryEvents(cursor: string | null, limit: number): Promise<SuiEventPage> {
    const parsedCursor = cursor ? JSON.parse(cursor) : null;
    let attempt = 0;
    const maxAttempts = 5;
    let delay = 1000;

    while (attempt < maxAttempts) {
      try {
        const response = await this.client.queryEvents({
          query: {
            MovePackage: this.packageId,
          } as any,
          cursor: parsedCursor,
          limit,
          order: 'ascending',
        });

        // Map response to RawSuiEvent
        const events: RawSuiEvent[] = response.data.map((e) => ({
          id: { txDigest: e.id.txDigest, eventSeq: e.id.eventSeq },
          packageId: e.packageId,
          transactionModule: e.transactionModule,
          sender: e.sender,
          type: e.type,
          parsedJson: e.parsedJson as Record<string, any>,
          timestampMs: e.timestampMs || String(Date.now()),
          checkpoint: (e as any).checkpoint,
        }));

        const nextCursor = response.nextCursor ? JSON.stringify(response.nextCursor) : null;

        return {
          events,
          nextCursor,
          hasNextPage: response.hasNextPage,
        };
      } catch (error: any) {
        attempt++;
        // Determine if it is a transient error: network timeout, 5xx, or connection refused.
        const isTransient = this.isTransientError(error);

        if (!isTransient || attempt >= maxAttempts) {
          console.error(`[sui] Final queryEvents failure after attempt ${attempt}:`, error);
          process.exit(1);
        }

        console.warn(`[sui] Transient error (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error('Sui client retry loop ended unexpectedly');
  }

  private isTransientError(error: any): boolean {
    const msg = String(error.message || '').toLowerCase();
    // Network errors (ECONNREFUSED, timeout, fetch failures) or HTTP 5xx codes
    if (
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504')
    ) {
      return true;
    }
    const status = error.status || error.statusCode;
    if (status && status >= 500 && status < 600) {
      return true;
    }
    return false;
  }
}
