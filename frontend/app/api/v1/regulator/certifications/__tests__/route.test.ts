/**
 * Tests for regulator certification issuance and audit (#482).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/cors', () => ({
  withCors: (_req: NextRequest, res: Response) => res,
  handleOptions: () => new Response(null, { status: 204 }),
}));
vi.mock('@/lib/api/rateLimit', () => ({
  applyRateLimit: vi.fn(() => null),
  RATE_LIMIT_PRESETS: { default: {}, publicRead: {} },
}));
vi.mock('@/lib/api/metrics', () => ({ recordRequest: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
});

const VALID_PAYLOAD = {
  productId: 'prod-cert-1',
  productName: 'Organic Coffee',
  issuerAddress: 'GISSUER1234567890',
  issuerAuthority: 'EU Organic Authority',
  certType: 'organic',
  scope: 'Full supply chain from farm to port',
  validityDays: 365,
};

// ── POST /api/v1/regulator/certifications ────────────────────────────────────

describe('POST /api/v1/regulator/certifications', () => {
  it('issues a certification with valid payload', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/v1/regulator/certifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.certification.productId).toBe('prod-cert-1');
    expect(body.certification.issuerAuthority).toBe('EU Organic Authority');
    expect(body.certification.status).toBe('active');
    expect(body.certification.txHash).toBeTruthy();
    expect(body.certification.auditTrail).toHaveLength(1);
    expect(body.certification.auditTrail[0].action).toBe('issued');
  });

  it('sets expiresAt when validityDays is provided', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/v1/regulator/certifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_PAYLOAD, validityDays: 30 }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.certification.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('../route');
    for (const field of ['productId', 'issuerAddress', 'issuerAuthority', 'certType', 'scope']) {
      const payload = { ...VALID_PAYLOAD, [field]: undefined };
      const req = new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }
  });

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/v1/regulator/certifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/regulator/certifications ─────────────────────────────────────

describe('GET /api/v1/regulator/certifications', () => {
  it('returns empty list initially', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/v1/regulator/certifications');
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.certifications).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('filters by productId', async () => {
    const { POST, GET } = await import('../route');

    for (const pid of ['prod-x', 'prod-y']) {
      await POST(
        new NextRequest('http://localhost/api/v1/regulator/certifications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...VALID_PAYLOAD, productId: pid }),
        }),
      );
    }

    const req = new NextRequest(
      'http://localhost/api/v1/regulator/certifications?productId=prod-x',
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.certifications.every((c: { productId: string }) => c.productId === 'prod-x')).toBe(
      true,
    );
  });

  it('filters by issuer', async () => {
    const { POST, GET } = await import('../route');

    await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...VALID_PAYLOAD, issuerAddress: 'GISSUER_A' }),
      }),
    );
    await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...VALID_PAYLOAD, issuerAddress: 'GISSUER_B' }),
      }),
    );

    const req = new NextRequest(
      'http://localhost/api/v1/regulator/certifications?issuer=GISSUER_A',
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(
      body.certifications.every((c: { issuerAddress: string }) => c.issuerAddress === 'GISSUER_A'),
    ).toBe(true);
  });

  it('includes effectiveStatus in response', async () => {
    const { POST, GET } = await import('../route');
    await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_PAYLOAD),
      }),
    );
    const res = await GET(new NextRequest('http://localhost/api/v1/regulator/certifications'));
    const body = await res.json();
    expect(body.certifications[0].effectiveStatus).toBe('active');
  });
});

// ── GET /api/v1/regulator/certifications/[id] ────────────────────────────────

describe('GET /api/v1/regulator/certifications/[id]', () => {
  it('returns a certification by id', async () => {
    const { POST } = await import('../route');
    const createRes = await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_PAYLOAD),
      }),
    );
    const { certification } = await createRes.json();

    const { GET } = await import('../[id]/route');
    const req = new NextRequest(
      `http://localhost/api/v1/regulator/certifications/${certification.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: certification.id }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.certification.id).toBe(certification.id);
  });

  it('returns 404 for unknown id', async () => {
    const { GET } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/v1/regulator/certifications/unknown');
    const res = await GET(req, { params: Promise.resolve({ id: 'unknown' }) });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/regulator/certifications/[id] ─────────────────────────────

describe('DELETE /api/v1/regulator/certifications/[id]', () => {
  it('revokes a certification', async () => {
    const { POST } = await import('../route');
    const createRes = await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_PAYLOAD),
      }),
    );
    const { certification } = await createRes.json();

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest(
      `http://localhost/api/v1/regulator/certifications/${certification.id}`,
      {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'GISSUER1234567890', note: 'Compliance violation' }),
      },
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: certification.id }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.certification.status).toBe('revoked');
    expect(body.certification.auditTrail).toHaveLength(2);
    expect(body.certification.auditTrail[1].action).toBe('revoked');
  });

  it('returns 409 when already revoked', async () => {
    const { POST } = await import('../route');
    const createRes = await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_PAYLOAD),
      }),
    );
    const { certification } = await createRes.json();

    const { DELETE } = await import('../[id]/route');
    const revokeReq = () =>
      new NextRequest(`http://localhost/api/v1/regulator/certifications/${certification.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'G1' }),
      });

    await DELETE(revokeReq(), { params: Promise.resolve({ id: certification.id }) });
    const res2 = await DELETE(revokeReq(), { params: Promise.resolve({ id: certification.id }) });
    expect(res2.status).toBe(409);
  });

  it('returns 400 when actor is missing', async () => {
    const { POST } = await import('../route');
    const createRes = await POST(
      new NextRequest('http://localhost/api/v1/regulator/certifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(VALID_PAYLOAD),
      }),
    );
    const { certification } = await createRes.json();

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest(
      `http://localhost/api/v1/regulator/certifications/${certification.id}`,
      {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: certification.id }) });
    expect(res.status).toBe(400);
  });
});

// ── Lib unit tests ────────────────────────────────────────────────────────────

describe('regulator certifications lib', () => {
  it('effectiveStatus returns expired for past expiresAt', async () => {
    const { effectiveStatus } = await import('@/lib/regulator/certifications');
    const cert = {
      id: 'x',
      productId: 'p',
      productName: 'P',
      issuerAddress: 'G1',
      issuerAuthority: 'Auth',
      certType: 'organic',
      scope: 'all',
      status: 'active' as const,
      issuedAt: Date.now() - 10000,
      expiresAt: Date.now() - 1000, // already expired
      auditTrail: [],
    };
    expect(effectiveStatus(cert)).toBe('expired');
  });

  it('effectiveStatus returns active for future expiresAt', async () => {
    const { effectiveStatus } = await import('@/lib/regulator/certifications');
    const cert = {
      id: 'x',
      productId: 'p',
      productName: 'P',
      issuerAddress: 'G1',
      issuerAuthority: 'Auth',
      certType: 'organic',
      scope: 'all',
      status: 'active' as const,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      auditTrail: [],
    };
    expect(effectiveStatus(cert)).toBe('active');
  });

  it('effectiveStatus returns active when expiresAt is 0 (no expiry)', async () => {
    const { effectiveStatus } = await import('@/lib/regulator/certifications');
    const cert = {
      id: 'x',
      productId: 'p',
      productName: 'P',
      issuerAddress: 'G1',
      issuerAuthority: 'Auth',
      certType: 'organic',
      scope: 'all',
      status: 'active' as const,
      issuedAt: Date.now(),
      expiresAt: 0,
      auditTrail: [],
    };
    expect(effectiveStatus(cert)).toBe('active');
  });
});
