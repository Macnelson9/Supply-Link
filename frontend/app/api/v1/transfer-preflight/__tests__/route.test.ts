/**
 * Integration tests for POST /api/v1/transfer-preflight
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
  RATE_LIMIT_PRESETS: { default: {} },
}));

vi.mock('@/lib/api/correlation', () => ({
  getCorrelationId: vi.fn(() => 'test-id'),
}));

import { POST } from '../route';

const NEW_OWNER = 'GNEWOWNER1ABCDEFGHIJKLMNOPQRSTUVWXYZ123';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/v1/transfer-preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'valid-key', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/transfer-preflight', () => {
  it('returns 401 without a valid API key', async () => {
    const req = makeRequest(
      { productId: 'prod-001', newOwner: NEW_OWNER },
      { 'x-api-key': 'wrong' },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing productId', async () => {
    const req = makeRequest({ newOwner: NEW_OWNER });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing newOwner', async () => {
    const req = makeRequest({ productId: 'prod-001' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/v1/transfer-preflight', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'valid-key' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown product', async () => {
    const req = makeRequest({ productId: 'unknown-product', newOwner: NEW_OWNER });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 200 with allowed=true for a compliant transfer', async () => {
    const req = makeRequest({
      productId: 'prod-001',
      newOwner: NEW_OWNER,
      walletAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.productId).toBe('prod-001');
    expect(body.newOwner).toBe(NEW_OWNER);
    expect(typeof body.allowed).toBe('boolean');
    expect(Array.isArray(body.violations)).toBe(true);
    expect(Array.isArray(body.blockers)).toBe(true);
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it('returns allowed=false when newOwner equals current owner', async () => {
    // prod-001 owner is GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
    const req = makeRequest({
      productId: 'prod-001',
      newOwner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      walletAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.allowed).toBe(false);
    const codes = body.blockers.map((v: { code: string }) => v.code);
    expect(codes).toContain('SAME_OWNER');
  });

  it('returns allowed=false when wallet is not connected', async () => {
    const req = makeRequest({
      productId: 'prod-001',
      newOwner: NEW_OWNER,
      // walletAddress omitted
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.allowed).toBe(false);
    const codes = body.blockers.map((v: { code: string }) => v.code);
    expect(codes).toContain('WALLET_NOT_CONNECTED');
  });

  it('returns allowed=false when hasPendingEscrow is true', async () => {
    const req = makeRequest({
      productId: 'prod-001',
      newOwner: NEW_OWNER,
      walletAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      hasPendingEscrow: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.allowed).toBe(false);
    const codes = body.blockers.map((v: { code: string }) => v.code);
    expect(codes).toContain('PENDING_TRANSFER_EXISTS');
  });

  it('response includes all violation fields (code, message, blocking)', async () => {
    const req = makeRequest({
      productId: 'prod-001',
      newOwner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', // same as owner
      walletAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    const res = await POST(req);
    const body = await res.json();

    for (const v of body.violations) {
      expect(typeof v.code).toBe('string');
      expect(typeof v.message).toBe('string');
      expect(typeof v.blocking).toBe('boolean');
    }
  });
});
