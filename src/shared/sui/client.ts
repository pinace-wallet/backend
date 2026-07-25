import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { bcs, pureBcsSchemaFromTypeName } from '@mysten/sui/bcs';

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

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
  // Opaque Relay-style GraphQL cursor. Not comparable/parseable — persist and
  // round-trip it as-is (see IndexerRepository.getCursor/upsertCheckpoint).
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface QueryModuleEventsResult {
  events: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      sender: { address: string } | null;
      timestamp: string | null;
      sequenceNumber: number | string;
      transactionModule: { name: string; package: { address: string } | null } | null;
      contents: { json: Record<string, unknown> | null; type: { repr: string } | null } | null;
      transaction: { digest: string } | null;
    }>;
  } | null;
}

const QUERY_MODULE_EVENTS = `
  query QueryModuleEvents($module: String!, $first: Int!, $after: String) {
    events(filter: { module: $module }, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        sender { address }
        timestamp
        sequenceNumber
        transactionModule { name package { address } }
        contents { json type { repr } }
        transaction { digest }
      }
    }
  }
`;

/**
 * Unwraps a Move struct's field map from a gRPC `include: { json: true }` response.
 * Mysten's docs warn the exact shape (flat vs. `{ fields: {...} }`-wrapped, as JSON-RPC
 * used to return) may vary between API implementations — handle both defensively.
 */
function unwrapFields(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const obj = v as Record<string, unknown>;
  if (obj.fields && typeof obj.fields === 'object') {
    return obj.fields as Record<string, unknown>;
  }
  return obj;
}

/** Unwraps a Move `UID`/`ID` value, which may be a plain string or `{ id: "0x.." }`. */
function unwrapId(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const id = (v as Record<string, unknown>).id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}

export class SuiClientWrapper {
  private grpc: SuiGrpcClient;
  private graphql: SuiGraphQLClient;
  private moduleFilter: string;

  constructor(grpcUrl: string, graphqlUrl: string, packageId: string, network: SuiNetwork = 'testnet') {
    this.grpc = new SuiGrpcClient({ baseUrl: grpcUrl, network });
    this.graphql = new SuiGraphQLClient({ url: graphqlUrl, network });
    this.moduleFilter = `${packageId}::events`;
  }

  /**
   * Queries events from the blockchain via GraphQL (gRPC has no module-filtered,
   * paginated event query — see sdk.mystenlabs.com/sui/migrations/sui-2.0/json-rpc-migration).
   * Filters events to the core package's events module with retry logic.
   * Requirements: 1.1, 1.3, 1.5, 1.7
   */
  async queryEvents(cursor: string | null, limit: number): Promise<SuiEventPage> {
    let attempt = 0;
    const maxAttempts = 5;
    let delay = 1000;

    while (attempt < maxAttempts) {
      try {
        const result = await this.graphql.query<QueryModuleEventsResult>({
          query: QUERY_MODULE_EVENTS,
          variables: { module: this.moduleFilter, first: limit, after: cursor },
        });

        if (result.errors?.length) {
          throw new Error(`GraphQL queryEvents error: ${result.errors.map((e) => e.message).join('; ')}`);
        }

        const connection = result.data?.events;
        const nodes = connection?.nodes ?? [];

        const events: RawSuiEvent[] = nodes.map((n, i) => ({
          id: {
            txDigest: n.transaction?.digest ?? '',
            eventSeq: String(n.sequenceNumber ?? i),
          },
          packageId: n.transactionModule?.package?.address ?? '',
          transactionModule: n.transactionModule?.name ?? '',
          sender: n.sender?.address ?? '',
          type: n.contents?.type?.repr ?? '',
          parsedJson: n.contents?.json ?? {},
          timestampMs: n.timestamp ? String(new Date(n.timestamp).getTime()) : String(Date.now()),
        }));

        return {
          events,
          nextCursor: connection?.pageInfo?.endCursor ?? null,
          hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
        };
      } catch (error: unknown) {
        attempt++;
        const isTransient = this.isTransientError(error);

        if (!isTransient || attempt >= maxAttempts) {
          console.error(`[sui] Final queryEvents failure after attempt ${attempt}:`, error);
          throw error;
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
      const poolRes = await this.grpc.core.getObject({ objectId: poolId, include: { json: true } });
      const poolFields = unwrapFields(poolRes.object.json);
      const delegationsTableId = unwrapId(unwrapFields(poolFields?.delegations)?.id);
      if (!delegationsTableId) return null;

      const addressBytes = pureBcsSchemaFromTypeName('address').serialize(agentAddress).toBytes();
      const dfDelegation = await this.grpc.core.getDynamicObjectField({
        parentId: delegationsTableId,
        name: { type: 'address', bcs: addressBytes },
        include: { json: true },
      });
      const delegationFields = unwrapFields(dfDelegation.object.json);
      const delValue = unwrapFields(delegationFields?.value);
      const configsBagId = unwrapId(unwrapFields(delValue?.configs)?.id);
      if (!configsBagId) return null;

      const typeNameBcs = bcs.struct('TypeName', { name: bcs.string() });
      const typeNameBytes = typeNameBcs.serialize({ name: policyType }).toBytes();
      const dfConfig = await this.grpc.core.getDynamicObjectField({
        parentId: configsBagId,
        name: { type: '0x1::type_name::TypeName', bcs: typeNameBytes },
        include: { json: true },
      });
      const cfgWrap = unwrapFields(dfConfig.object.json);
      const cfgValue = unwrapFields(cfgWrap?.value);
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
