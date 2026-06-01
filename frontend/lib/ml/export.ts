/**
 * AI-ready provenance export for ML ingest (#481).
 *
 * Serializes product + event data into a normalized, flat schema
 * suitable for machine-learning pipelines and analytics tools.
 *
 * Export schema (MLExportRecord):
 *   - One row per tracking event
 *   - Product metadata denormalized onto each row
 *   - All timestamps as Unix seconds (float)
 *   - Categorical fields as lowercase strings
 *   - Numeric fields as numbers (never strings)
 *   - Missing values as null (never undefined)
 */

import type { Product, TrackingEvent } from '@/lib/types';

export const ML_EXPORT_SCHEMA_VERSION = 1;

/** A single normalized row in the ML export. */
export interface MLExportRecord {
  // ── Schema metadata ──────────────────────────────────────────────────────
  schema_version: number;
  exported_at: string; // ISO-8601

  // ── Product fields ───────────────────────────────────────────────────────
  product_id: string;
  product_name: string;
  product_origin: string;
  product_owner: string;
  product_registered_at: number; // Unix seconds
  product_active: boolean;
  product_recalled: boolean;

  // ── Event fields ─────────────────────────────────────────────────────────
  event_type: string; // lowercase: harvest, processing, shipping, retail
  event_location: string;
  event_actor: string;
  event_timestamp: number; // Unix seconds
  event_sequence: number; // 0-based index within product's event list

  // ── Derived features (useful for ML) ────────────────────────────────────
  /** Seconds elapsed since the previous event for this product (null for first event) */
  seconds_since_prev_event: number | null;
  /** Total number of events for this product at time of export */
  total_events_for_product: number;
  /** Number of unique actors involved up to and including this event */
  unique_actors_so_far: number;
  /** Whether this event's actor is the product owner */
  actor_is_owner: boolean;
}

export interface MLExportPayload {
  schema_version: number;
  exported_at: string;
  record_count: number;
  product_count: number;
  records: MLExportRecord[];
}

/**
 * Build a normalized ML export from a map of products and their events.
 *
 * @param products  List of products to include
 * @param eventsMap Map of productId → sorted (oldest-first) events
 */
export function buildMLExport(
  products: Product[],
  eventsMap: Map<string, TrackingEvent[]>,
): MLExportPayload {
  const exportedAt = new Date().toISOString();
  const records: MLExportRecord[] = [];

  for (const product of products) {
    const events = (eventsMap.get(product.id) ?? [])
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);

    const seenActors = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const prev = i > 0 ? events[i - 1] : null;

      seenActors.add(ev.actor);

      records.push({
        schema_version: ML_EXPORT_SCHEMA_VERSION,
        exported_at: exportedAt,

        product_id: product.id,
        product_name: product.name,
        product_origin: product.origin,
        product_owner: product.owner,
        product_registered_at: product.timestamp,
        product_active: product.active !== false,
        product_recalled: product.recalled ?? false,

        event_type: ev.eventType.toLowerCase(),
        event_location: ev.location,
        event_actor: ev.actor,
        event_timestamp: ev.timestamp,
        event_sequence: i,

        seconds_since_prev_event: prev !== null ? (ev.timestamp - prev.timestamp) / 1000 : null,
        total_events_for_product: events.length,
        unique_actors_so_far: seenActors.size,
        actor_is_owner: ev.actor === product.owner,
      });
    }
  }

  return {
    schema_version: ML_EXPORT_SCHEMA_VERSION,
    exported_at: exportedAt,
    record_count: records.length,
    product_count: products.length,
    records,
  };
}

/** Serialize an ML export payload to NDJSON (one JSON object per line). */
export function toNDJSON(payload: MLExportPayload): string {
  return payload.records.map((r) => JSON.stringify(r)).join('\n');
}

/** Serialize an ML export payload to CSV. */
export function toCSV(payload: MLExportPayload): string {
  if (payload.records.length === 0) return '';

  const headers = Object.keys(payload.records[0]) as (keyof MLExportRecord)[];
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = [
    headers.join(','),
    ...payload.records.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  return rows.join('\n');
}
