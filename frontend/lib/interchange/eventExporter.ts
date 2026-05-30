/**
 * Event exporter — converts internal Supply-Link types to the interchange format.
 *
 * Keeps all serialisation logic in one place so the API route stays thin.
 */

import type { Product, TrackingEvent } from '@/lib/types';
import {
  INTERCHANGE_SCHEMA_VERSION,
  INTERCHANGE_CONTEXT,
  type EventInterchangePayload,
  type InterchangeEvent,
  type InterchangeProduct,
} from './eventSchema';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a Unix ms timestamp to ISO 8601 UTC string */
function toIso(tsMs: number): string {
  return new Date(tsMs).toISOString();
}

/** Parse a metadata JSON string safely — returns {} on failure */
function parseMeta(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

/** Generate a deterministic fallback ID when stableId is absent */
function fallbackId(event: TrackingEvent): string {
  const key = `${event.productId}|${event.actor}|${event.eventType}|${event.timestamp}`;
  // Simple djb2 hash — good enough for a fallback, not cryptographic
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) ^ key.charCodeAt(i);
  return `sl-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

// ── Serialisers ───────────────────────────────────────────────────────────────

export function serializeProduct(product: Product): InterchangeProduct {
  return {
    '@type': 'Product',
    id: product.id,
    name: product.name,
    origin: product.origin,
    owner: product.owner,
    registeredAt: toIso(product.timestamp),
    active: product.active ?? true,
    category: product.category,
    subcategory: product.subcategory,
  };
}

export function serializeEvent(event: TrackingEvent): InterchangeEvent {
  return {
    '@type': 'SupplyChainEvent',
    id: event.stableId ?? fallbackId(event),
    productId: event.productId,
    eventType: event.eventType,
    location: event.location,
    actor: event.actor,
    occurredAt: toIso(event.timestamp),
    metadata: parseMeta(event.metadata),
    sourceSchemaVersion: event.schemaVersion,
  };
}

// ── Main export builder ───────────────────────────────────────────────────────

export interface ExportOptions {
  offset?: number;
  limit?: number;
}

/**
 * Build a complete interchange payload for a product's event history.
 *
 * @param product  The product record
 * @param events   All events for the product (pre-filtered/sorted by caller)
 * @param options  Pagination options
 */
export function buildInterchangePayload(
  product: Product,
  events: TrackingEvent[],
  options: ExportOptions = {},
): EventInterchangePayload {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 100;

  const page = events.slice(offset, offset + limit);

  return {
    '@context': INTERCHANGE_CONTEXT,
    '@type': 'SupplyChainEventHistory',
    schemaVersion: INTERCHANGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: 'supply-link',
    product: serializeProduct(product),
    events: page.map(serializeEvent),
    totalEvents: events.length,
    offset,
    limit,
  };
}
