/**
 * Integration tests for GET /api/v1/events/export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/auth', () => ({
  authenticateApiRequest: vi.fn(async (req: NextRequest) => {
    if (req.headers.get('x-api-key') === 'valid-key') return { error: null, apiKey: 'valid-key' };
    const { NextResponse } = await import('next/server');
    return {
      error: NextResponse.json(
        { error: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid', correlationId: 'x' } },
        { status: 401 },
      ),
    };
  }),
}));

vi.mock('@/lib/api/rateLimit', () => ({
  applyRateLimit: vi.fn(() => null),
  RATE_LIMIT_PRESETS: { publicRead: {}, authenticated: {}, default: {} },
}));

vi.mock('@/lib/api/correlation', () => ({
  getCorrelationId: vi.fn(() => 'test-id'),
}));

import { GET } from '../route';

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-api-key': 'valid-key', ...headers },
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/events/export', () => {
  it('returns 400 when productId is missing', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a valid API key', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export?productId=prod-001', {
      'x-api-key': 'wrong',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown product', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export?productId=unknown-product');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 200 with a valid interchange payload for a known product', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export?productId=prod-001');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body['@context']).toContain('supply-link');
    expect(body['@type']).toBe('SupplyChainEventHistory');
    expect(body.schemaVersion).toBe('1.0.0');
    expect(body.source).toBe('supply-link');
    expect(body.product.id).toBe('prod-001');
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.totalEvents).toBe('number');
  });

  it('events are sorted oldest-first', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export?productId=prod-001');
    const res = await GET(req);
    const body = await res.json();

    const timestamps = body.events.map((e: { occurredAt: string }) => e.occurredAt);
    const sorted = [...timestamps].sort();
    expect(timestamps).toEqual(sorted);
  });

  it('each event has the required interchange fields', async () => {
    const req = makeRequest('http://localhost/api/v1/events/export?productId=prod-001');
    const res = await GET(req);
    const body = await res.json();

    for (const event of body.events) {
      expect(event['@type']).toBe('SupplyChainEvent');
      expect(typeof event.id).toBe('string');
      expect(typeof event.productId).toBe('string');
      expect(typeof event.eventType).toBe('string');
      expect(typeof event.location).toBe('string');
      expect(typeof event.actor).toBe('string');
      expect(typeof event.occurredAt).toBe('string');
      expect(typeof event.metadata).toBe('object');
    }
  });

  it('respects offset and limit pagination', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/events/export?productId=prod-001&offset=1&limit=2',
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.events.length).toBeLessThanOrEqual(2);
    expect(body.offset).toBe(1);
    expect(body.limit).toBe(2);
  });

  it('sets Content-Type to application/ld+json when format=jsonld', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/events/export?productId=prod-001&format=jsonld',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/ld+json');
  });

  it('caps limit at 500', async () => {
    const req = makeRequest(
      'http://localhost/api/v1/events/export?productId=prod-001&limit=9999',
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.limit).toBe(500);
  });
});
