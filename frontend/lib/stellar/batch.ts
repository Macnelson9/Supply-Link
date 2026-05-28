/**
 * Batch registration utilities for Supply-Link (#389).
 *
 * Provides size validation, byte-size estimation, and splitting helpers
 * for the `register_products_batch` contract method.
 */

export const MAX_BATCH_SIZE = 10;
export const RECOMMENDED_BATCH_SIZE = 5;

/** Approximate bytes per product registration (id + name + origin + overhead) */
const BYTES_PER_PRODUCT = 512;

/** Soroban transaction size limit (bytes) */
const TX_SIZE_LIMIT = 65536;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchSizeWarning {
  level: "ok" | "warn" | "error";
  message: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Check whether a proposed batch size is within acceptable limits.
 *
 * - `"ok"` — safe to submit
 * - `"warn"` — above the recommended size; may be slow or expensive
 * - `"error"` — exceeds the on-chain maximum of {@link MAX_BATCH_SIZE}
 */
export function checkBatchSize(count: number): BatchSizeWarning {
  if (count > MAX_BATCH_SIZE) {
    return {
      level: "error",
      message: `Batch size ${count} exceeds the maximum of ${MAX_BATCH_SIZE}. Split into smaller batches.`,
    };
  }
  if (count > RECOMMENDED_BATCH_SIZE) {
    return {
      level: "warn",
      message: `Large batch (${count} products). Consider splitting into batches of ${RECOMMENDED_BATCH_SIZE} for reliability.`,
    };
  }
  return { level: "ok", message: "" };
}

// ── Size estimation ───────────────────────────────────────────────────────────

/**
 * Estimate the encoded byte size of a batch of products.
 *
 * Each character is counted as 2 bytes (UTF-16 / XDR string encoding),
 * plus a fixed per-product overhead for struct fields and XDR framing.
 */
export function estimateBatchBytes(
  products: Array<{ id: string; name: string; origin: string }>
): number {
  return products.reduce(
    (sum, p) =>
      sum + (p.id.length + p.name.length + p.origin.length) * 2 + BYTES_PER_PRODUCT,
    0
  );
}

/**
 * Returns `true` when the estimated encoded size of the batch would exceed
 * the Soroban transaction size limit.
 */
export function willExceedTxLimit(
  products: Array<{ id: string; name: string; origin: string }>
): boolean {
  return estimateBatchBytes(products) > TX_SIZE_LIMIT;
}

// ── Splitting ─────────────────────────────────────────────────────────────────

/**
 * Split an array of items into sub-arrays of at most `batchSize` elements.
 *
 * @example
 * splitIntoBatches([1,2,3,4,5], 2) // → [[1,2],[3,4],[5]]
 */
export function splitIntoBatches<T>(
  items: T[],
  batchSize: number = RECOMMENDED_BATCH_SIZE
): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
