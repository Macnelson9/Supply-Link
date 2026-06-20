/**
 * POST /api/v1/insurance/[id]/process-claim – automatically process a claim
 *
 * Runs the auto-approval workflow: verifies eligibility, applies threshold
 * rules, and either auto-approves, auto-rejects, or routes to manual review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordRequest } from '@/lib/api/metrics';
import { getCoverage, processClaimAutomatically } from '@/lib/services/insuranceCoverage';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

const ProcessClaimSchema = z.object({
  claimId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'POST /api/v1/insurance/[id]/process-claim',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.authenticated,
  );
  if (limited) {
    recordRequest('POST /api/v1/insurance/[id]/process-claim', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'internal');
  if (auth.error) {
    recordRequest('POST /api/v1/insurance/[id]/process-claim', 401, Date.now() - start);
    return auth.error;
  }

  const { id } = await params;

  const coverage = getCoverage(id);
  if (!coverage) {
    recordRequest('POST /api/v1/insurance/[id]/process-claim', 404, Date.now() - start);
    return withCors(
      request,
      apiError(request, 404, ErrorCode.VALIDATION_ERROR, `Coverage record not found: ${id}`),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(
      request,
      apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Invalid JSON body'),
    );
  }

  const parsed = ProcessClaimSchema.safeParse(body);
  if (!parsed.success) {
    recordRequest('POST /api/v1/insurance/[id]/process-claim', 422, Date.now() - start);
    return withCors(
      request,
      apiError(request, 422, ErrorCode.VALIDATION_ERROR, 'Validation failed', {
        details: parsed.error.flatten(),
      }),
    );
  }

  const result = processClaimAutomatically(id, parsed.data.claimId);
  if (!result) {
    recordRequest('POST /api/v1/insurance/[id]/process-claim', 404, Date.now() - start);
    return withCors(request, apiError(request, 404, ErrorCode.VALIDATION_ERROR, 'Claim not found'));
  }

  recordRequest('POST /api/v1/insurance/[id]/process-claim', 200, Date.now() - start);
  return withCors(request, withCorrelationId(request, NextResponse.json(result, { status: 200 })));
}
