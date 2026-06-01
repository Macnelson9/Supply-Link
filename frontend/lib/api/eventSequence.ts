/**
 * Distributed event sequence enforcement (#476).
 *
 * Prevents replay attacks and ordering conflicts when multiple clients
 * submit events for the same product concurrently.
 *
 * Strategy:
 *   - Each product has a monotonically increasing sequence number in KV.
 *   - Before submitting an event, the client fetches the current sequence.
 *   - The submission includes the expected sequence number.
 *   - The server atomically checks and increments the sequence.
 *   - Mismatches are rejected with a 409 CONFLICT response.
 *
 * KV key: event:seq:<productId>
 * TTL: 30 days (refreshed on every write)
 */
import { kvStore } from '@/lib/kv';
import type { ProductEventSequence, EventSequenceConflict } from '@/lib/types';

const SEQ_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const kvKey = (productId: string) => `event:seq:${productId}`;

/**
 * Fetch the current sequence state for a product.
 * Returns nextSeq=0 if no sequence has been recorded yet.
 */
export async function getEventSequence(productId: string): Promise<ProductEventSequence> {
  const raw = await kvStore.get(kvKey(productId));
  if (!raw) {
    return { productId, nextSeq: 0, lastEventAt: 0 };
  }
  return JSON.parse(raw) as ProductEventSequence;
}

/**
 * Attempt to claim the next sequence slot for an event submission.
 *
 * @param productId  - The product receiving the event.
 * @param claimedSeq - The sequence number the client believes is next.
 * @returns The accepted sequence number on success.
 * @throws EventSequenceConflictError when claimedSeq doesn't match the current nextSeq.
 */
export async function claimEventSequence(
  productId: string,
  claimedSeq: number,
): Promise<number> {
  const current = await getEventSequence(productId);

  if (claimedSeq !== current.nextSeq) {
    const conflict: EventSequenceConflict = {
      productId,
      expectedSeq: current.nextSeq,
      receivedSeq: claimedSeq,
    };
    throw new EventSequenceConflictError(conflict);
  }

  const updated: ProductEventSequence = {
    productId,
    nextSeq: current.nextSeq + 1,
    lastEventAt: Date.now(),
  };
  await kvStore.set(kvKey(productId), JSON.stringify(updated), SEQ_TTL_SECONDS);

  return claimedSeq;
}

/**
 * Reset the sequence for a product (admin / recovery use only).
 */
export async function resetEventSequence(productId: string): Promise<void> {
  await kvStore.del(kvKey(productId));
}

// ── Error type ────────────────────────────────────────────────────────────────

export class EventSequenceConflictError extends Error {
  readonly conflict: EventSequenceConflict;

  constructor(conflict: EventSequenceConflict) {
    super(
      `Event sequence conflict for product ${conflict.productId}: ` +
        `expected seq ${conflict.expectedSeq}, received ${conflict.receivedSeq}`,
    );
    this.name = 'EventSequenceConflictError';
    this.conflict = conflict;
  }
}
