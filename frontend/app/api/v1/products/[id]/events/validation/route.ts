/**
 * GET /api/v1/products/[id]/events/validation?stableId=<id>
 *
 * Returns the async validation result for a specific event.
 * The UI polls this endpoint to show pending/passed/failed status (#475).
 *
 * Authentication: x-api-key (partner)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { authenticateApiRequest } from '@/lib/api/auth';
import { kvStore } from '@/lib/kv';
import type { EventValidationResult } from '@/lib/types';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) return auth.error;

  const stableId = request.nextUrl.searchParams.get('stableId');
  if (!stableId) {
    return apiError(
      request,
      400,
      ErrorCode.MISSING_FIELDS,
      'Missing required query param: stableId',
    );
  }

  const raw = await kvStore.get(`validation:${stableId}`);
  if (!raw) {
    // Job not yet processed — return pending status
    const { id } = await params;
    const pending: EventValidationResult = {
      eventStableId: stableId,
      productId: id,
      status: 'pending',
      checks: [],
    };
    return withCors(
      request,
      withCorrelationId(request, NextResponse.json(pending, { status: 200 })),
    );
  }

  const result = JSON.parse(raw) as EventValidationResult;
  return withCors(request, withCorrelationId(request, NextResponse.json(result, { status: 200 })));
}
