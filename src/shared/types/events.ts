/**
 * Typed event payload interfaces derived from the @pinace/contracts-sdk event schemas.
 * Fields match the JSON representation returned by Sui's JSON RPC:
 *   - Address / u64  → string
 *   - u8             → number
 *   - vector<u8>     → number[]
 *   - TypeName       → { name: string }
 */

export interface TypeName {
  name: string;
}

export interface PoolCreatedPayload {
  pool_id: string;
  owner: string;
  version: string;
}

export interface DepositPayload {
  pool_id: string;
  owner: string;
  coin_type: TypeName;
  amount: string;
}

export interface WithdrawPayload {
  pool_id: string;
  owner: string;
  coin_type: TypeName;
  amount: string;
  recipient: string;
}

export interface AgentConnectedPayload {
  pool_id: string;
  owner: string;
  agent: string;
  expires_ms: string;
}

export interface AgentRevokedPayload {
  pool_id: string;
  owner: string;
  agent: string;
  reason: number[];
}

export interface PolicyAttachedPayload {
  pool_id: string;
  owner: string;
  agent: string;
  policy_type: TypeName;
  config_hash: number[];
  marketplace_id: number[];
}

export interface PolicyUpdatedPayload {
  pool_id: string;
  owner: string;
  agent: string;
  policy_type: TypeName;
  config_hash: number[];
  marketplace_id: number[];
}

export interface PolicyRemovedPayload {
  pool_id: string;
  owner: string;
  agent: string;
  policy_type: TypeName;
}

export interface ActionProposedPayload {
  pool_id: string;
  agent: string;
  nonce: string;
  kind: number;
  amount_in: string;
  min_amount_out: string;
}

export interface ActionSettledPayload {
  pool_id: string;
  agent: string;
  nonce: string;
  kind: number;
  status: number;
  amount_in: string;
  quoted_amount_out: string;
  min_amount_out: string;
}

/** Converts a vector<u8> byte array to a hex string, or null if empty. */
export function bytesToHex(bytes: number[]): string | null {
  if (bytes.length === 0) return null;
  return Buffer.from(bytes).toString('hex');
}
