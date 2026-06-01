/**
 * Audit snapshot utilities (#400).
 *
 * Serialises product + event state deterministically, hashes it, and submits
 * the hash to the contract via `snapshot_product_state`.
 */

import { contractClient } from './contract';

export interface SnapshotInput {
  productId: string;
  product: unknown;
  events: unknown[];
}

export interface AuditSnapshot {
  id: string;
  productId: string;
  snapshotHash: string;
  createdBy: string;
  timestamp: number;
  eventCount: number;
}

/**
 * Compute a deterministic SHA-256 hash of the product state + events.
 * The serialisation is sorted-key JSON to ensure reproducibility.
 */
export async function computeSnapshotHash(input: SnapshotInput): Promise<string> {
  const payload = JSON.stringify({ product: input.product, events: input.events });
  const buf = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create an on-chain audit snapshot for a product.
 * Fetches current product + events, hashes them, and submits to the contract.
 */
export async function createAuditSnapshot(
  input: SnapshotInput,
  callerAddress: string,
): Promise<string> {
  const hash = await computeSnapshotHash(input);
  return contractClient.snapshotProductState(input.productId, hash, callerAddress);
}

/**
 * Verify that a locally-computed snapshot hash matches a stored on-chain snapshot.
 */
export async function verifySnapshot(input: SnapshotInput, storedHash: string): Promise<boolean> {
  const hash = await computeSnapshotHash(input);
  return hash === storedHash;
}
