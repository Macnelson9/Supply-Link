/**
 * Tests for the event interchange exporter:
 *   - Payload structure and required fields
 *   - ISO 8601 timestamp conversion
 *   - Metadata parsing (valid JSON, invalid JSON, empty)
 *   - Pagination (offset, limit, totalEvents)
 *   - Stable ID fallback when stableId is absent
 *   - Schema version constant
 */

import { describe, it, expect } from 'vitest';
import type { Product, TrackingEvent } from '@/lib/types';
import { buildInterchangePayload, serializeEvent, serializeProduct } from '../eventExporter';
import { INTERCHANGE_SCHEMA_VERSION, INTERCHANGE_CONTEXT } from '../eventSchema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT: Product = {
  id: 'prod-test',
  name: 'Test Product',
  origin: 'Test Origin',
  owner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  timestamp: 1710000000000,
  active: true,
  authorizedActors: [],
  category: 'agricultural',
  subcategory: 'coffee',
};

function makeEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    productId: 'prod-test',
    eventType: 'HARVEST',
    location: 'Farm A',
    actor: 'GACTOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567',
    timestamp: 1710100000000,
    metadata: '{"notes":"test"}',
    stableId: 'stable-abc123',
    ...overrides,
  };
}

// ── serializeProduct ──────────────────────────────────────────────────────────

describe('serializeProduct', () => {
  it('sets @type to Product', () => {
    const result = serializeProduct(PRODUCT);
    expect(result['@type']).toBe('Product');
  });

  it('converts timestamp to ISO 8601 string', () => {
    const result = serializeProduct(PRODUCT);
    expect(result.registeredAt).toBe(new Date(1710000000000).toISOString());
  });

  it('maps all required fields', () => {
    const result = serializeProduct(PRODUCT);
    expect(result.id).toBe('prod-test');
    expect(result.name).toBe('Test Product');
    expect(result.origin).toBe('Test Origin');
    expect(result.owner).toBe('GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result.active).toBe(true);
    expect(result.category).toBe('agricultural');
    expect(result.subcategory).toBe('coffee');
  });

  it('defaults active to true when undefined', () => {
    const p = { ...PRODUCT, active: undefined };
    const result = serializeProduct(p as Product);
    expect(result.active).toBe(true);
  });
});

// ── serializeEvent ────────────────────────────────────────────────────────────

describe('serializeEvent', () => {
  it('sets @type to SupplyChainEvent', () => {
    const result = serializeEvent(makeEvent());
    expect(result['@type']).toBe('SupplyChainEvent');
  });

  it('uses stableId as the event id', () => {
    const result = serializeEvent(makeEvent({ stableId: 'my-stable-id' }));
    expect(result.id).toBe('my-stable-id');
  });

  it('generates a fallback id when stableId is absent', () => {
    const result = serializeEvent(makeEvent({ stableId: undefined }));
    expect(result.id).toMatch(/^sl-[0-9a-f]{8}$/);
  });

  it('converts timestamp to ISO 8601 string', () => {
    const result = serializeEvent(makeEvent({ timestamp: 1710100000000 }));
    expect(result.occurredAt).toBe(new Date(1710100000000).toISOString());
  });

  it('parses valid JSON metadata into an object', () => {
    const result = serializeEvent(makeEvent({ metadata: '{"key":"value","num":42}' }));
    expect(result.metadata).toEqual({ key: 'value', num: 42 });
  });

  it('returns empty object for empty metadata string', () => {
    const result = serializeEvent(makeEvent({ metadata: '' }));
    expect(result.metadata).toEqual({});
  });

  it('wraps invalid JSON metadata in a raw field', () => {
    const result = serializeEvent(makeEvent({ metadata: 'not-json' }));
    expect(result.metadata).toEqual({ raw: 'not-json' });
  });

  it('wraps a JSON array in a value field', () => {
    const result = serializeEvent(makeEvent({ metadata: '[1,2,3]' }));
    expect(result.metadata).toEqual({ value: [1, 2, 3] });
  });

  it('maps all required fields', () => {
    const event = makeEvent();
    const result = serializeEvent(event);
    expect(result.productId).toBe('prod-test');
    expect(result.eventType).toBe('HARVEST');
    expect(result.location).toBe('Farm A');
    expect(result.actor).toBe('GACTOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567');
  });
});

// ── buildInterchangePayload ───────────────────────────────────────────────────

describe('buildInterchangePayload', () => {
  const events = [
    makeEvent({ timestamp: 1710000000000, eventType: 'HARVEST' }),
    makeEvent({ timestamp: 1710100000000, eventType: 'PROCESSING' }),
    makeEvent({ timestamp: 1710200000000, eventType: 'SHIPPING' }),
    makeEvent({ timestamp: 1710300000000, eventType: 'RETAIL' }),
  ];

  it('sets the correct @context and @type', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    expect(payload['@context']).toBe(INTERCHANGE_CONTEXT);
    expect(payload['@type']).toBe('SupplyChainEventHistory');
  });

  it('sets schemaVersion to the current constant', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    expect(payload.schemaVersion).toBe(INTERCHANGE_SCHEMA_VERSION);
  });

  it('sets source to supply-link', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    expect(payload.source).toBe('supply-link');
  });

  it('sets exportedAt to a valid ISO 8601 string', () => {
    const before = new Date().toISOString();
    const payload = buildInterchangePayload(PRODUCT, events);
    const after = new Date().toISOString();
    expect(payload.exportedAt >= before).toBe(true);
    expect(payload.exportedAt <= after).toBe(true);
  });

  it('includes the serialised product', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    expect(payload.product.id).toBe('prod-test');
    expect(payload.product['@type']).toBe('Product');
  });

  it('returns all events when no pagination options given', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    expect(payload.events).toHaveLength(4);
    expect(payload.totalEvents).toBe(4);
    expect(payload.offset).toBe(0);
    expect(payload.limit).toBe(100);
  });

  it('paginates correctly with offset and limit', () => {
    const payload = buildInterchangePayload(PRODUCT, events, { offset: 1, limit: 2 });
    expect(payload.events).toHaveLength(2);
    expect(payload.events[0].eventType).toBe('PROCESSING');
    expect(payload.events[1].eventType).toBe('SHIPPING');
    expect(payload.totalEvents).toBe(4);
    expect(payload.offset).toBe(1);
    expect(payload.limit).toBe(2);
  });

  it('returns empty events array when offset exceeds total', () => {
    const payload = buildInterchangePayload(PRODUCT, events, { offset: 10, limit: 5 });
    expect(payload.events).toHaveLength(0);
    expect(payload.totalEvents).toBe(4);
  });

  it('handles an empty events array', () => {
    const payload = buildInterchangePayload(PRODUCT, []);
    expect(payload.events).toHaveLength(0);
    expect(payload.totalEvents).toBe(0);
  });

  it('serialises each event with the correct @type', () => {
    const payload = buildInterchangePayload(PRODUCT, events);
    payload.events.forEach((e) => {
      expect(e['@type']).toBe('SupplyChainEvent');
    });
  });
});
