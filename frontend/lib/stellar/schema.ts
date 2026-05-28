/**
 * Schema versioning utilities for Supply-Link on-chain data (#392).
 *
 * When the on-chain struct layout changes, bump CURRENT_SCHEMA_VERSION and add
 * a migration branch in migrateProduct / migrateTrackingEvent.
 */

import type { Product, TrackingEvent } from "@/lib/types";

export const CURRENT_SCHEMA_VERSION = 1;

// ── Normalizers ───────────────────────────────────────────────────────────────
// Convert raw on-chain data (unknown shape) into typed frontend objects,
// filling in defaults for any fields that may be absent in older records.

/**
 * Normalize a raw on-chain product record into a typed `Product`.
 * Handles v1 layout; adds safe defaults for any missing fields.
 */
export function normalizeProduct(raw: unknown): Product {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("normalizeProduct: expected an object");
  }

  const r = raw as Record<string, unknown>;

  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    origin: String(r.origin ?? ""),
    owner: String(r.owner ?? ""),
    timestamp: typeof r.timestamp === "number" ? r.timestamp : 0,
    active: typeof r.active === "boolean" ? r.active : true,
    authorizedActors: Array.isArray(r.authorized_actors)
      ? (r.authorized_actors as unknown[]).map(String)
      : Array.isArray(r.authorizedActors)
      ? (r.authorizedActors as unknown[]).map(String)
      : [],
    recalled: typeof r.recalled === "boolean" ? r.recalled : false,
    recallReason:
      typeof r.recall_reason === "string"
        ? r.recall_reason
        : typeof r.recallReason === "string"
        ? r.recallReason
        : "",
    recallTimestamp:
      typeof r.recall_timestamp === "number"
        ? r.recall_timestamp
        : typeof r.recallTimestamp === "number"
        ? r.recallTimestamp
        : 0,
    schemaVersion:
      typeof r.schema_version === "number"
        ? r.schema_version
        : typeof r.schemaVersion === "number"
        ? r.schemaVersion
        : CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Normalize a raw on-chain tracking event into a typed `TrackingEvent`.
 * Handles v1 layout; adds safe defaults for any missing fields.
 */
export function normalizeTrackingEvent(raw: unknown): TrackingEvent {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("normalizeTrackingEvent: expected an object");
  }

  const r = raw as Record<string, unknown>;

  const eventType = (
    r.event_type ?? r.eventType ?? "SHIPPING"
  ) as TrackingEvent["eventType"];

  return {
    productId: String(r.product_id ?? r.productId ?? ""),
    location: String(r.location ?? ""),
    actor: String(r.actor ?? ""),
    timestamp: typeof r.timestamp === "number" ? r.timestamp : 0,
    eventType,
    metadata: String(r.metadata ?? ""),
    schemaVersion:
      typeof r.schema_version === "number"
        ? r.schema_version
        : typeof r.schemaVersion === "number"
        ? r.schemaVersion
        : CURRENT_SCHEMA_VERSION,
  };
}

// ── Migrators ─────────────────────────────────────────────────────────────────
// Upgrade a typed object from an older schema version to the current one.
// v1 → v1 is a no-op; add branches here when CURRENT_SCHEMA_VERSION is bumped.

/**
 * Migrate a `Product` to the current schema version.
 * No-op for v1; extensible for future versions.
 */
export function migrateProduct(p: Product): Product {
  const version = p.schemaVersion ?? 1;

  if (version === CURRENT_SCHEMA_VERSION) {
    return p;
  }

  // Future migration example:
  // if (version === 1) {
  //   return migrateProduct({ ...p, newField: defaultValue, schemaVersion: 2 });
  // }

  return p;
}

/**
 * Migrate a `TrackingEvent` to the current schema version.
 * No-op for v1; extensible for future versions.
 */
export function migrateTrackingEvent(e: TrackingEvent): TrackingEvent {
  const version = e.schemaVersion ?? 1;

  if (version === CURRENT_SCHEMA_VERSION) {
    return e;
  }

  return e;
}
