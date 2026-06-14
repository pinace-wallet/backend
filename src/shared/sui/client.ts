import { SuiJsonRpcClient, type SuiEvent } from '@mysten/sui/jsonRpc';

export interface RawSuiEvent {
  id: { txDigest: string; eventSeq: string };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: Record<string, unknown>;
  timestampMs: string;
  checkpoint?: string;
}

export interface SuiEventPage {
  events: RawSuiEvent[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export class SuiClientWrapper {
  private client: SuiJsonRpcClient;
  private packageId: string;

  constructor(rpcUrl: string, packageId: string) {
    this.client = new SuiJsonRpcClient({ url: rpcUrl, network: 'testnet' });
    this.packageId = packageId;
  }

  /**
   * Queries events from the blockchain.
   * Filters events to the core package's events module with retry logic.
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
            MoveEventModule: { package: this.packageId, module: 'events' },
          },
          cursor: parsedCursor,
          limit,
          order: 'ascending',
        });

        const events: RawSuiEvent[] = response.data.map((e: SuiEvent) => ({
          id: { txDigest: e.id.txDigest, eventSeq: e.id.eventSeq },
          packageId: e.packageId,
          transactionModule: e.transactionModule,
          sender: e.sender,
          type: e.type,
          parsedJson: e.parsedJson as Record<string, unknown>,
          timestampMs: e.timestampMs ?? String(Date.now()),
          checkpoint: (e as Record<string, unknown>).checkpoint as string | undefined,
        }));

        const nextCursor = response.nextCursor ? JSON.stringify(response.nextCursor) : null;

        return {
          events,
          nextCursor,
          hasNextPage: response.hasNextPage,
        };
      } catch (error: unknown) {
        attempt++;
        const isTransient = this.isTransientError(error);

        if (!isTransient || attempt >= maxAttempts) {
          console.error(`[sui] Final queryEvents failure after attempt ${attempt}:`, error);
          process.exit(1);
        }

        console.warn(`[sui] Transient error (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`, (error as Error).message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error('Sui client retry loop ended unexpectedly');
  }

  /**
   * Reads the on-chain Config struct attached to a (pool, agent, policyType)
   * by walking dynamic fields:
   *   pool.delegations: Table<address, Delegation>  → DF(agent)
   *     .value.configs: Bag<TypeName, Config>       → DF(policyType TypeName)
   *       .value.fields                              ← the actual config values
   *
   * Returns `null` on any 404 / parse failure — handler should still persist
   * the policy row so removal events still match.
   */
  async readPolicyConfig(
    poolId: string,
    agentAddress: string,
    policyType: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const pool = await this.client.getObject({ id: poolId, options: { showContent: true } });
      const poolContent = (pool.data?.content as { fields?: Record<string, unknown> } | undefined)
        ?.fields;
      const delegations = (poolContent?.delegations as { fields?: { id?: { id?: string } } } | undefined)
        ?.fields;
      const delegationsTableId = delegations?.id?.id;
      if (!delegationsTableId) return null;

      const dfDelegation = await this.client.getDynamicFieldObject({
        parentId: delegationsTableId,
        name: { type: 'address', value: agentAddress },
      });
      const delegationFields = (dfDelegation.data?.content as { fields?: Record<string, unknown> } | undefined)
        ?.fields;
      const delValue = (delegationFields?.value as { fields?: Record<string, unknown> } | undefined)
        ?.fields;
      const configsBagId = (
        delValue?.configs as { fields?: { id?: { id?: string } } } | undefined
      )?.fields?.id?.id;
      if (!configsBagId) return null;

      const dfConfig = await this.client.getDynamicFieldObject({
        parentId: configsBagId,
        name: { type: '0x1::type_name::TypeName', value: { name: policyType } },
      });
      const cfgWrap = (dfConfig.data?.content as { fields?: Record<string, unknown> } | undefined)
        ?.fields;
      const cfgValue = (cfgWrap?.value as { fields?: Record<string, unknown> } | undefined)?.fields;
      return cfgValue ?? null;
    } catch (e) {
      console.warn(
        `[sui] readPolicyConfig failed for pool=${poolId} agent=${agentAddress} type=${policyType}:`,
        (e as Error).message,
      );
      return null;
    }
  }

  private isTransientError(error: unknown): boolean {
    const msg = String((error as Error).message || '').toLowerCase();
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
    const status = (error as Record<string, unknown>).status || (error as Record<string, unknown>).statusCode;
    if (typeof status === 'number' && status >= 500 && status < 600) {
      return true;
    }
    return false;
  }
}
