/**
 * POST /api/v1/regulator/certifications  — issue a regulator certification
 * GET  /api/v1/regulator/certifications  — list certifications (filter by productId or issuer)
 *
 * closes #482
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { recordRequest } from '@/lib/api/metrics';
import {
  issueCertification,
  listCertifications,
  listByIssuer,
  effectiveStatus,
} from '@/lib/regulator/certifications';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'POST /api/v1/regulator/certifications',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('POST /api/v1/regulator/certifications', 429, Date.now() - start);
    return limited;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(request, apiError(request, 400, ErrorCode.INVALID_JSON, 'Invalid JSON'));
  }

  const { productId, productName, issuerAddress, issuerAuthority, certType, scope, validityDays } =
    body as Record<string, unknown>;

  if (!productId || typeof productId !== 'string')
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'productId is required'),
    );
  if (!productName || typeof productName !== 'string')
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'productName is required'),
    );
  if (!issuerAddress || typeof issuerAddress !== 'string')
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'issuerAddress is required'),
    );
  if (!issuerAuthority || typeof issuerAuthority !== 'string')
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'issuerAuthority is required'),
    );
  if (!certType || typeof certType !== 'string')
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'certType is required'),
    );
  if (!scope || typeof scope !== 'string')
    return withCors(request, apiError(request, 400, ErrorCode.MISSING_FIELDS, 'scope is required'));

  const cert = issueCertification({
    productId,
    productName,
    issuerAddress,
    issuerAuthority,
    certType,
    scope,
    validityDays: typeof validityDays === 'number' ? validityDays : 0,
  });

  console.log('[regulator cert] issued', { id: cert.id, productId, issuerAuthority });

  const res = NextResponse.json({ certification: cert }, { status: 201 });
  recordRequest('POST /api/v1/regulator/certifications', 201, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'GET /api/v1/regulator/certifications',
    RATE_LIMIT_PRESETS.publicRead,
  );
  if (limited) {
    recordRequest('GET /api/v1/regulator/certifications', 429, Date.now() - start);
    return limited;
  }

  const { searchParams } = request.nextUrl;
  const productId = searchParams.get('productId') ?? undefined;
  const issuer = searchParams.get('issuer') ?? undefined;

  const certs = issuer ? listByIssuer(issuer) : listCertifications(productId);

  // Resolve effective status for each cert
  const enriched = certs.map((c) => ({ ...c, effectiveStatus: effectiveStatus(c) }));

  const res = NextResponse.json(
    { certifications: enriched, total: enriched.length },
    { status: 200 },
  );
  recordRequest('GET /api/v1/regulator/certifications', 200, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}
