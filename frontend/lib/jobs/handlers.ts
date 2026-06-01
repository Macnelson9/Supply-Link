/**
 * Built-in job handlers for heavy operations.
 *
 * Import this module once at app startup (e.g. in a route that uses jobs)
 * to register all handlers.
 */
import { registerHandler } from './types';

// ── Image processing ──────────────────────────────────────────────────────────
registerHandler<{ url: string; productId: string }>('image.process', async (job) => {
  // Placeholder: resize / compress / generate thumbnail via sharp or similar.
  // Replace with real implementation when image pipeline is added.
  console.log(`[jobs] image.process productId=${job.payload.productId} url=${job.payload.url}`);
});

// ── Analytics aggregation ─────────────────────────────────────────────────────
registerHandler<{ productId: string }>('analytics.aggregate', async (job) => {
  // Placeholder: recompute provenance score, event stats, etc.
  console.log(`[jobs] analytics.aggregate productId=${job.payload.productId}`);
});

// ── Malware / content scan ────────────────────────────────────────────────────
registerHandler<{ url: string; jobId: string }>('scan.malware', async (job) => {
  // Placeholder: call external scanning service.
  console.log(`[jobs] scan.malware url=${job.payload.url}`);
});

// ── Event indexer ─────────────────────────────────────────────────────────────
registerHandler<Record<string, never>>('indexer.tick', async () => {
  const { runIndexerTick } = await import('@/lib/indexer/indexerWorker');
  const result = await runIndexerTick();
  console.log(`[jobs] indexer.tick indexed=${result.indexed} ledger=${result.toledger}`);
});

// ── Async event validation (#475) ─────────────────────────────────────────────
import type { TrackingEvent } from '@/lib/types';
import { kvStore } from '@/lib/kv';
import { runValidationTasks } from './validationTasks';

export interface EventValidationPayload {
  event: TrackingEvent;
  stableId: string;
}

const VALIDATION_TTL = 7 * 24 * 60 * 60; // 7 days
const kvValidationKey = (stableId: string) => `validation:${stableId}`;

registerHandler<EventValidationPayload>('event.validate', async (job) => {
  const { event, stableId } = job.payload;
  const { status, checks } = await runValidationTasks(event);

  const result = {
    eventStableId: stableId,
    productId: event.productId,
    status,
    checks,
    validatedAt: Date.now(),
  };

  await kvStore.set(kvValidationKey(stableId), JSON.stringify(result), VALIDATION_TTL);
  console.log(`[jobs] event.validate stableId=${stableId} status=${status}`);
});
