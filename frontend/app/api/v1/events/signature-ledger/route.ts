/**
 * GET /api/v1/events/signature-ledger?productId=<id>
 *
 * Export a product's event signature ledger for audit purposes.
 * Returns signer addresses, event hashes, and timestamps.
 *
 * Query params:
 *   productId  (required) — product to export
 *   offset     (optional) — pagination offset, default 0
 *   limit      (optional) — max events per page, default 100, max 500
 *
 * Authentication: partner tier or higher (x-api-key)
 * Rate limiting: publicRead preset
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordRequest } from '@/lib/api/metrics';
import { getProductById, getEventsByProductId } from '@/lib/mock/products';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

interface SignatureLedgerEntry {
  eventIndex: number;
  productId: string;
  eventType: string;
  signerAddress: string;
  eventHash: string;
  timestamp: number;
  location: string;
}

interface SignatureLedgerResponse {
  productId: string;
  totalEvents: number;
  offset: number;
  limit: number;
  entries: SignatureLedgerEntry[];
  exportedAt: string;
}

function hashEvent(
  productId: string,
  actor: string,
  eventType: string,
  timestamp: number,
  metadata: string,
): string {
  const canonical = `${productId}|${actor}|${eventType}|${timestamp}|${metadata}`;
  return createHash('sha256').update(canonical).digest('hex');
}

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'GET /api/v1/events/signature-ledger',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.authenticated,
  );
  if (limited) {
    recordRequest('GET /api/v1/events/signature-ledger', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) {
    recordRequest('GET /api/v1/events/signature-ledger', 401, Date.now() - start);
    return auth.error;
  }

  const { searchParams } = request.nextUrl;
  const productId = searchParams.get('productId');

  if (!productId) {
    const res = withCors(
      request,
      apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'productId query parameter is required'),
    );
    recordRequest('GET /api/v1/events/signature-ledger', 400, Date.now() - start);
    return res;
  }

  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));

  const product = getProductById(productId);
  if (!product) {
    const res = withCors(
      request,
      apiError(request, 404, ErrorCode.VALIDATION_ERROR, `Product '${productId}' not found`),
    );
    recordRequest('GET /api/v1/events/signature-ledger', 404, Date.now() - start);
    return res;
  }

  const allEvents = getEventsByProductId(productId).sort((a, b) => a.timestamp - b.timestamp);

  const entries: SignatureLedgerEntry[] = allEvents
    .slice(offset, offset + limit)
    .map((event, idx) => ({
      eventIndex: offset + idx,
      productId: event.product_id,
      eventType: event.event_type,
      signerAddress: event.actor,
      eventHash: hashEvent(
        event.product_id,
        event.actor,
        event.event_type,
        event.timestamp,
        event.metadata,
      ),
      timestamp: event.timestamp,
      location: event.location,
    }));

  const payload: SignatureLedgerResponse = {
    productId,
    totalEvents: allEvents.length,
    offset,
    limit,
    entries,
    exportedAt: new Date().toISOString(),
  };

  const inner = NextResponse.json(payload, { status: 200 });
  const response = withCors(request, withCorrelationId(request, inner));
  recordRequest('GET /api/v1/events/signature-ledger', response.status, Date.now() - start);
  return response;
}
