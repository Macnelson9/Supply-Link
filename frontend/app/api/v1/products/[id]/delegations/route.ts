/**
 * GET  /api/v1/products/[id]/delegations  – list active delegations
 * POST /api/v1/products/[id]/delegations  – create a delegation
 *
 * Authentication: x-api-key (partner or internal)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { authenticateApiRequest } from '@/lib/api/auth';
import { getProductById } from '@/lib/mock/products';
import { recordApprovalEvent } from '@/lib/api/approvalLog';
import { delegationStore } from '@/lib/services/delegationStore';
import type { Delegation } from '@/lib/types';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!getProductById(id)) {
    return apiError(request, 404, ErrorCode.VALIDATION_ERROR, `Product not found: ${id}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const active = delegationStore.list(id).filter((d) => !d.revoked && d.expiresAt > now);
  return withCors(request, withCorrelationId(request, NextResponse.json(active, { status: 200 })));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!getProductById(id)) {
    return apiError(request, 404, ErrorCode.VALIDATION_ERROR, `Product not found: ${id}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(request, 400, ErrorCode.INVALID_PAYLOAD, 'Invalid JSON');
  }

  if (typeof body.delegatee !== 'string' || !body.delegatee.trim()) {
    return apiError(request, 400, ErrorCode.MISSING_FIELDS, 'Missing: delegatee');
  }
  if (typeof body.expiresAt !== 'number' || body.expiresAt <= Math.floor(Date.now() / 1000)) {
    return apiError(
      request,
      400,
      ErrorCode.VALIDATION_ERROR,
      'expiresAt must be a future timestamp',
    );
  }

  const delegation: Delegation = {
    delegationId: Date.now(),
    productId: id,
    delegator: auth.apiKey ?? 'unknown',
    delegatee: body.delegatee as string,
    expiresAt: body.expiresAt as number,
    revoked: false,
    createdAt: Math.floor(Date.now() / 1000),
  };

  delegationStore.add(delegation);

  recordApprovalEvent({
    action: 'delegate_actor_authority',
    productId: id,
    actor: delegation.delegator,
    target: delegation.delegatee,
    success: true,
  });

  return withCors(
    request,
    withCorrelationId(request, NextResponse.json(delegation, { status: 201 })),
  );
}
