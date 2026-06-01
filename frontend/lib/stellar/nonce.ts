/**
 * Nonce utilities for replay protection (#401).
 *
 * The contract tracks a per-actor sequential nonce. The frontend must fetch
 * the current nonce before each write and include it in the call.
 */

import { contractClient } from './contract';

/**
 * Fetch the current on-chain nonce for an actor and return it ready for use.
 * The contract increments the nonce on each successful write, so this value
 * is consumed exactly once.
 */
export async function fetchNonce(actor: string, callerAddress: string): Promise<number> {
  return contractClient.getNonce(actor, callerAddress);
}

/**
 * Compute a deterministic event payload hash for client-side deduplication.
 * Mirrors the contract's `compute_stable_id` logic.
 *
 * Format: SHA-256 of `productId|actor|eventType|timestamp|metadata` (UTF-8).
 */
export async function computeEventHash(
  productId: string,
  actor: string,
  eventType: string,
  timestamp: number,
  metadata: string,
): Promise<string> {
  const payload = `${productId}|${actor}|${eventType}|${timestamp}|${metadata}`;
  const buf = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
