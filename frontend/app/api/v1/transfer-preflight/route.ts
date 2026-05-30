/**
 * POST /api/v1/transfer-preflight
 *
 * Server-side pre-transfer compliance check. Returns whether a transfer
 * is allowed and the full list of violations/warnings.
 *
 * Body: { productId, newOwner, walletAddress? }
 *
 * Authentication: partner tier or higher
 * Rate limiting: default preset
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordRequest } from '@/lib/api/metrics';
import { getProductById } from '@/lib/mock/products';
import { checkTransferCompliance } from '@/lib/transferCompliance';

export const runtime = 'nodejs';

const bodySchema = z.object({
  productId: z.string().trim().min(1).max(128),
  newOwner: z.string().trim().min(1).max(256),
  walletAddress: z.string().trim().max(256).optional(),
  hasPendingEscrow: z.boolean().optional(),
});

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'POST /api/v1/transfer-preflight',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('POST /api/v1/transfer-preflight', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) {
    recordRequest('POST /api/v1/transfer-preflight', 401, Date.now() - start);
    return auth.error;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const res = withCors(
      request,
      apiError(request, 400, ErrorCode.INVALID_JSON, 'Invalid JSON body'),
    );
    recordRequest('POST /api/v1/transfer-preflight', 400, Date.now() - start);
    return res;
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      location: 'body' as const,
      message: i.message,
    }));
    const res = withCors(
      request,
      apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed', { details }),
    );
    recordRequest('POST /api/v1/transfer-preflight', 400, Date.now() - start);
    return res;
  }

  const { productId, newOwner, walletAddress, hasPendingEscrow } = parsed.data;

  const product = getProductById(productId);
  if (!product) {
    const res = withCors(
      request,
      apiError(request, 404, ErrorCode.VALIDATION_ERROR, `Product '${productId}' not found`),
    );
    recordRequest('POST /api/v1/transfer-preflight', 404, Date.now() - start);
    return res;
  }

  const result = checkTransferCompliance({
    product,
    newOwner,
    walletAddress: walletAddress ?? null,
    hasPendingEscrow,
  });

  const response = withCors(
    request,
    withCorrelationId(
      request,
      NextResponse.json(
        {
          productId,
          newOwner,
          allowed: result.allowed,
          violations: result.violations,
          blockers: result.blockers,
          warnings: result.warnings,
        },
        { status: 200 },
      ),
    ),
  );

  recordRequest('POST /api/v1/transfer-preflight', response.status, Date.now() - start);
  return response;
}
