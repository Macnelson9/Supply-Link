/**
 * GET /api/analytics/usage
 *
 * Retrieve API usage analytics for platform operations.
 * Returns endpoint consumption, error rates, and performance metrics.
 *
 * Query params:
 *   timeWindow (optional) — hours to analyze, default 24, max 168 (7 days)
 *
 * Authentication: internal API key required
 * Rate limiting: internal preset
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordRequest } from '@/lib/api/metrics';
import { getUsageAnalytics } from '@/lib/analytics/usageAnalytics';

export const runtime = 'nodejs';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'GET /api/analytics/usage',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.authenticated,
  );
  if (limited) {
    recordRequest('GET /api/analytics/usage', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'internal');
  if (auth.error) {
    recordRequest('GET /api/analytics/usage', 401, Date.now() - start);
    return auth.error;
  }

  const { searchParams } = request.nextUrl;
  const timeWindow = Math.min(
    168,
    Math.max(1, parseInt(searchParams.get('timeWindow') ?? '24', 10) || 24),
  );

  const analytics = getUsageAnalytics(timeWindow);

  const inner = NextResponse.json(analytics, { status: 200 });
  const response = withCors(request, withCorrelationId(request, inner));
  recordRequest('GET /api/analytics/usage', response.status, Date.now() - start);
  return response;
}
