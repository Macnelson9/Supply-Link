/**
 * Supply-Link Event Interchange Schema
 *
 * Defines the canonical JSON-LD format for exporting product event histories
 * to external integration partners. The schema is versioned and self-describing.
 *
 * Design goals:
 *   - JSON-LD context for semantic interoperability (GS1, Schema.org)
 *   - Stable field names that won't change across Supply-Link versions
 *   - All timestamps as ISO 8601 strings (UTC) for maximum compatibility
 *   - Envelope carries schema version so consumers can detect format changes
 *
 * Schema version history:
 *   1.0.0 — initial release
 */

// ── Schema version ────────────────────────────────────────────────────────────

export const INTERCHANGE_SCHEMA_VERSION = '1.0.0';

/** JSON-LD @context URI — partners can dereference this for full vocabulary */
export const INTERCHANGE_CONTEXT = 'https://supply-link.app/schemas/event-interchange/v1';

// ── Interchange types ─────────────────────────────────────────────────────────

/** A single supply-chain event in interchange format */
export interface InterchangeEvent {
  /** JSON-LD type */
  '@type': 'SupplyChainEvent';
  /** Stable deterministic event ID (SHA-256 hex, or generated if absent) */
  id: string;
  /** ID of the product this event belongs to */
  productId: string;
  /**
   * Event stage. One of the canonical Supply-Link stages:
   * HARVEST | PROCESSING | SHIPPING | RETAIL
   * or a custom string for extensibility.
   */
  eventType: string;
  /** Geographic or organisational location where the event occurred */
  location: string;
  /** Stellar wallet address of the actor who recorded the event */
  actor: string;
  /** ISO 8601 UTC timestamp */
  occurredAt: string;
  /** Raw metadata object (parsed from JSON string, or empty object) */
  metadata: Record<string, unknown>;
  /** Schema version of the source record */
  sourceSchemaVersion?: number;
}

/** Product summary embedded in the export envelope */
export interface InterchangeProduct {
  '@type': 'Product';
  id: string;
  name: string;
  origin: string;
  /** Stellar wallet address of the current owner */
  owner: string;
  /** ISO 8601 UTC timestamp of product registration */
  registeredAt: string;
  active: boolean;
  category?: string;
  subcategory?: string;
}

/** Top-level export envelope */
export interface EventInterchangePayload {
  '@context': string;
  '@type': 'SupplyChainEventHistory';
  /** Interchange schema version — consumers must check this first */
  schemaVersion: string;
  /** ISO 8601 UTC timestamp when this export was generated */
  exportedAt: string;
  /** Exporting system identifier */
  source: 'supply-link';
  product: InterchangeProduct;
  events: InterchangeEvent[];
  /** Total number of events (may differ from events.length when paginated) */
  totalEvents: number;
  /** Pagination cursor — offset of the first event in this payload */
  offset: number;
  /** Maximum events per page */
  limit: number;
}
