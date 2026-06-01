/**
 * GET    /api/product/recall/escalation/[id]  — get a single escalation
 * PATCH  /api/product/recall/escalation/[id]  — advance escalation stage
 *
 * closes #480
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { recordRequest } from '@/lib/api/metrics';
import {
  getEscalation,
  advanceEscalation,
  buildStakeholderNotification,
  addNotifiedStakeholder,
} from '@/lib/recall/escalation';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const start = Date.now();
  const { id } = await params;

  const limited = applyRateLimit(
    request,
    'GET /api/product/recall/escalation/[id]',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('GET /api/product/recall/escalation/[id]', 429, Date.now() - start);
    return limited;
  }

  const escalation = getEscalation(id);
  if (!escalation) {
    return withCors(
      request,
      apiError(request, 404, ErrorCode.VALIDATION_ERROR, 'Escalation not found'),
    );
  }

  const res = NextResponse.json({ escalation }, { status: 200 });
  recordRequest('GET /api/product/recall/escalation/[id]', 200, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const start = Date.now();
  const { id } = await params;

  const limited = applyRateLimit(
    request,
    'PATCH /api/product/recall/escalation/[id]',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('PATCH /api/product/recall/escalation/[id]', 429, Date.now() - start);
    return limited;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(request, apiError(request, 400, ErrorCode.INVALID_JSON, 'Invalid JSON'));
  }

  const { actor, note, stakeholders } = body as Record<string, unknown>;

  if (!actor || typeof actor !== 'string') {
    return withCors(request, apiError(request, 400, ErrorCode.MISSING_FIELDS, 'actor is required'));
  }

  const updated = advanceEscalation(id, actor, typeof note === 'string' ? note : undefined);
  if (!updated) {
    const existing = getEscalation(id);
    if (!existing) {
      return withCors(
        request,
        apiError(request, 404, ErrorCode.VALIDATION_ERROR, 'Escalation not found'),
      );
    }
    return withCors(
      request,
      apiError(
        request,
        409,
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Escalation is already in a terminal stage',
      ),
    );
  }

  // Record additional stakeholders notified at this stage
  if (Array.isArray(stakeholders)) {
    for (const s of stakeholders) {
      if (typeof s === 'string') addNotifiedStakeholder(id, s);
    }
  }

  const notification = buildStakeholderNotification(updated);
  console.log('[recall escalation] advanced', { id, stage: updated.stage, notification });

  const res = NextResponse.json({ escalation: updated, notification }, { status: 200 });
  recordRequest('PATCH /api/product/recall/escalation/[id]', 200, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}
