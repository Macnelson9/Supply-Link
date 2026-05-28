/**
 * GET /api/approvals  — approval audit log and stats (#424)
 *
 * Returns recent approval/authorization events and aggregate stats for the
 * observability dashboard.
 *
 * Authentication: internal API key only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { authenticateApiRequest } from '@/lib/api/auth';
import { getApprovalLog, getApprovalStats } from '@/lib/api/approvalLog';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request, 'internal');
  if (auth.error) return auth.error;

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10), 500);
  if (isNaN(limit) || limit < 1) {
    return apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Invalid limit');
  }

  const body = {
    stats: getApprovalStats(),
    entries: getApprovalLog(limit),
  };

  return withCors(request, withCorrelationId(request, NextResponse.json(body, { status: 200 })));
}
