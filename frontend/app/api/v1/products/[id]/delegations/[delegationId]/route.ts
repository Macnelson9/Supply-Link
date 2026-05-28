/**
 * DELETE /api/v1/products/[id]/delegations/[delegationId]  – revoke a delegation
 *
 * Authentication: x-api-key (partner or internal)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordApprovalEvent } from '@/lib/api/approvalLog';
import { delegationStore } from '@/lib/services/delegationStore';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; delegationId: string }> },
): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) return auth.error;

  const { id, delegationId } = await params;
  const numId = parseInt(delegationId, 10);
  if (isNaN(numId)) {
    return apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Invalid delegationId');
  }

  const revoked = delegationStore.revoke(id, numId);
  if (!revoked) {
    return apiError(request, 404, ErrorCode.VALIDATION_ERROR, 'Delegation not found');
  }

  recordApprovalEvent({
    action: 'revoke_delegate',
    productId: id,
    actor: auth.apiKey ?? 'unknown',
    target: revoked.delegatee,
    success: true,
  });

  return withCors(
    request,
    withCorrelationId(request, NextResponse.json({ revoked: true }, { status: 200 })),
  );
}
