/**
 * POST /api/product/recall/escalation  — create a recall escalation
 * GET  /api/product/recall/escalation  — list escalations (optionally by productId)
 *
 * closes #480
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { recordRequest } from '@/lib/api/metrics';
import {
  createEscalation,
  listEscalations,
  buildStakeholderNotification,
  addNotifiedStakeholder,
  type RecallPriority,
} from '@/lib/recall/escalation';

const VALID_PRIORITIES: RecallPriority[] = ['low', 'medium', 'high', 'critical'];

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'POST /api/product/recall/escalation',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('POST /api/product/recall/escalation', 429, Date.now() - start);
    return limited;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(request, apiError(request, 400, ErrorCode.INVALID_JSON, 'Invalid JSON'));
  }

  const { productId, productName, reason, priority, initiatedBy, stakeholders } = body as Record<
    string,
    unknown
  >;

  if (!productId || typeof productId !== 'string') {
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'productId is required'),
    );
  }
  if (!productName || typeof productName !== 'string') {
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'productName is required'),
    );
  }
  if (!reason || typeof reason !== 'string') {
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'reason is required'),
    );
  }
  if (!priority || !VALID_PRIORITIES.includes(priority as RecallPriority)) {
    return withCors(
      request,
      apiError(
        request,
        400,
        ErrorCode.VALIDATION_ERROR,
        `priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      ),
    );
  }
  if (!initiatedBy || typeof initiatedBy !== 'string') {
    return withCors(
      request,
      apiError(request, 400, ErrorCode.MISSING_FIELDS, 'initiatedBy is required'),
    );
  }

  const escalation = createEscalation({
    productId,
    productName,
    reason,
    priority: priority as RecallPriority,
    initiatedBy,
  });

  // Record initial stakeholders if provided
  if (Array.isArray(stakeholders)) {
    for (const s of stakeholders) {
      if (typeof s === 'string') addNotifiedStakeholder(escalation.id, s);
    }
  }

  const notification = buildStakeholderNotification(escalation);

  // In production: trigger notification delivery (email/webhook) here
  console.log('[recall escalation] created', { id: escalation.id, notification });

  const res = NextResponse.json({ escalation, notification }, { status: 201 });
  recordRequest('POST /api/product/recall/escalation', 201, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'GET /api/product/recall/escalation',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('GET /api/product/recall/escalation', 429, Date.now() - start);
    return limited;
  }

  const productId = request.nextUrl.searchParams.get('productId') ?? undefined;
  const escalations = listEscalations(productId);

  const res = NextResponse.json({ escalations, total: escalations.length }, { status: 200 });
  recordRequest('GET /api/product/recall/escalation', 200, Date.now() - start);
  return withCors(request, withCorrelationId(request, res));
}
