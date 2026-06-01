/**
 * GET /api/v1/products/[id]/events  – list tracking events for a product (paginated)
 * POST /api/v1/products/[id]/events – add a new tracking event
 *
 * Authentication: x-api-key (partner or internal)
 * Rate limiting: partner tier
 * Idempotency: POST requests via Idempotency-Key header
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { withIdempotency } from '@/lib/api/idempotency';
import { getProductById, getEventsByProductId, MOCK_EVENTS } from '@/lib/mock/products';
import { recordRequest } from '@/lib/api/metrics';
import { validateEventMetadata } from '@/lib/api/eventMetadataSchemas';
import {
  claimEventSequence,
  getEventSequence,
  EventSequenceConflictError,
} from '@/lib/api/eventSequence';
import { enqueue } from '@/lib/jobs/queue';
import type { TrackingEvent, PaginatedResponse, EventType } from '@/lib/types';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

async function listEvents(
  req: NextRequest,
  productId: string,
  apiKey: string,
): Promise<NextResponse> {
  // Verify product exists
  const product = getProductById(productId);
  if (!product) {
    return apiError(req, 404, ErrorCode.VALIDATION_ERROR, `Product not found: ${productId}`);
  }

  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100);

  if (offset < 0 || limit < 1) {
    return apiError(req, 400, ErrorCode.VALIDATION_ERROR, 'Invalid offset or limit');
  }

  const allEvents = getEventsByProductId(productId);
  const items = allEvents.slice(offset, offset + limit);

  const response: PaginatedResponse<TrackingEvent> = {
    items,
    total: allEvents.length,
    offset,
    limit,
  };

  return withCors(req, withCorrelationId(req, NextResponse.json(response, { status: 200 })));
}

async function addEvent(
  req: NextRequest,
  productId: string,
  apiKey: string,
  rawBody: string,
): Promise<NextResponse> {
  // Verify product exists
  const product = getProductById(productId);
  if (!product) {
    return apiError(req, 404, ErrorCode.VALIDATION_ERROR, `Product not found: ${productId}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiError(req, 400, ErrorCode.INVALID_PAYLOAD, 'Invalid JSON');
  }

  const body = payload as Record<string, unknown>;

  // Validate required fields
  const eventTypes: EventType[] = ['HARVEST', 'PROCESSING', 'SHIPPING', 'RETAIL'];
  if (!eventTypes.includes(body.eventType as EventType)) {
    return apiError(
      req,
      400,
      ErrorCode.VALIDATION_ERROR,
      `Invalid eventType. Allowed: ${eventTypes.join(', ')}`,
    );
  }

  if (typeof body.location !== 'string' || !body.location.trim()) {
    return apiError(req, 400, ErrorCode.MISSING_FIELDS, 'Missing or invalid: location');
  }

  if (typeof body.actor !== 'string' || !body.actor.trim()) {
    return apiError(req, 400, ErrorCode.MISSING_FIELDS, 'Missing or invalid: actor');
  }

  // Validate typed metadata shape by event type
  const metadata = typeof body.metadata === 'string' ? body.metadata : '{}';
  const metadataValidation = validateEventMetadata(body.eventType as string, metadata);
  if (!metadataValidation.valid) {
    return apiError(
      req,
      400,
      ErrorCode.VALIDATION_ERROR,
      `Invalid metadata: ${metadataValidation.error}`,
    );
  }

  // ── Sequence enforcement (#476) ───────────────────────────────────────────
  // Clients must include the expected sequence number to prevent concurrent
  // submissions from creating inconsistent event histories.
  const claimedSeq = typeof body.seq === 'number' ? body.seq : null;
  if (claimedSeq === null) {
    return apiError(
      req,
      400,
      ErrorCode.MISSING_FIELDS,
      'Missing required field: seq (fetch current sequence from GET /api/v1/products/{id}/events/sequence)',
    );
  }

  let acceptedSeq: number;
  try {
    acceptedSeq = await claimEventSequence(productId, claimedSeq);
  } catch (err) {
    if (err instanceof EventSequenceConflictError) {
      return apiError(
        req,
        409,
        ErrorCode.VALIDATION_ERROR,
        `Event sequence conflict: expected ${err.conflict.expectedSeq}, received ${err.conflict.receivedSeq}. Fetch the latest sequence and retry.`,
      );
    }
    throw err;
  }

  // Create new event
  const newEvent: TrackingEvent = {
    productId,
    eventType: body.eventType as EventType,
    location: body.location as string,
    actor: body.actor as string,
    timestamp: Date.now(),
    metadata,
    seq: acceptedSeq,
  };

  // TODO: Persist to database instead of mock
  MOCK_EVENTS.push(newEvent);

  // Enqueue async validation job (#475)
  const stableId = newEvent.stableId ?? `${productId}-${acceptedSeq}-${newEvent.timestamp}`;
  await enqueue('event.validate', { event: { ...newEvent, stableId }, stableId });

  return withCors(req, withCorrelationId(req, NextResponse.json(newEvent, { status: 201 })));
}

async function addEventsBatch(
  req: NextRequest,
  productId: string,
  apiKey: string,
  rawBody: string,
): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiError(req, 400, ErrorCode.INVALID_PAYLOAD, 'Invalid JSON');
  }

  if (!Array.isArray(payload)) {
    return apiError(req, 400, ErrorCode.INVALID_PAYLOAD, 'Expected an array of events');
  }

  const results: Array<Record<string, unknown>> = [];
  const product = getProductById(productId);
  if (!product) {
    return apiError(req, 404, ErrorCode.VALIDATION_ERROR, `Product not found: ${productId}`);
  }

  const eventTypes: EventType[] = ['HARVEST', 'PROCESSING', 'SHIPPING', 'RETAIL'];

  for (let i = 0; i < payload.length; i++) {
    const item = payload[i] as Record<string, unknown>;
    const resEntry: Record<string, unknown> = { index: i };

    // Field validation
    if (!eventTypes.includes(item.eventType as EventType)) {
      resEntry.success = false;
      resEntry.error = `Invalid eventType at index ${i}`;
      results.push(resEntry);
      continue;
    }

    if (typeof item.location !== 'string' || !item.location.trim()) {
      resEntry.success = false;
      resEntry.error = `Missing or invalid location at index ${i}`;
      results.push(resEntry);
      continue;
    }

    if (typeof item.actor !== 'string' || !item.actor.trim()) {
      resEntry.success = false;
      resEntry.error = `Missing or invalid actor at index ${i}`;
      results.push(resEntry);
      continue;
    }

    // Authorization: actor must be product owner or authorized actor
    const actorStr = item.actor as string;
    const isOwner = product.owner === actorStr;
    const isActor = product.authorizedActors?.includes(actorStr) ?? false;
    if (!isOwner && !isActor) {
      resEntry.success = false;
      resEntry.error = `Actor not authorized at index ${i}`;
      results.push(resEntry);
      continue;
    }

    // Metadata validation
    const metadata = typeof item.metadata === 'string' ? item.metadata : '{}';
    const metadataValidation = validateEventMetadata(item.eventType as string, metadata);
    if (!metadataValidation.valid) {
      resEntry.success = false;
      resEntry.error = `Invalid metadata at index ${i}: ${metadataValidation.error}`;
      results.push(resEntry);
      continue;
    }

    // Create and persist (mock)
    const newEvent: TrackingEvent = {
      productId,
      eventType: item.eventType as EventType,
      location: item.location as string,
      actor: actorStr,
      timestamp: Date.now(),
      metadata,
    };
    MOCK_EVENTS.push(newEvent);

    resEntry.success = true;
    resEntry.event = newEvent;
    results.push(resEntry);
  }

  return withCors(req, withCorrelationId(req, NextResponse.json({ results }, { status: 200 })));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const start = Date.now();

  // Public read endpoint — no authentication required.
  const limited = applyRateLimit(
    request,
    'GET /api/v1/products/[id]/events',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.publicRead,
  );
  if (limited) {
    recordRequest('GET /api/v1/products/[id]/events', 429, Date.now() - start);
    return limited;
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    recordRequest('GET /api/v1/products/[id]/events', 400, Date.now() - start);
    return apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Invalid product ID');
  }

  const response = await listEvents(request, id, '');
  recordRequest('GET /api/v1/products/[id]/events', response.status, Date.now() - start);
  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const start = Date.now();

  // Apply IP-based rate limiting
  const limited = applyRateLimit(
    request,
    'POST /api/v1/products/[id]/events',
    RATE_LIMIT_PRESETS.default,
  );
  if (limited) {
    recordRequest('POST /api/v1/products/[id]/events', 429, Date.now() - start);
    return limited;
  }

  // Authenticate API key
  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) {
    recordRequest('POST /api/v1/products/[id]/events', 401, Date.now() - start);
    return auth.error;
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    recordRequest('POST /api/v1/products/[id]/events', 400, Date.now() - start);
    return apiError(request, 400, ErrorCode.VALIDATION_ERROR, 'Invalid product ID');
  }

  const rawBody = await request.text();

  // If the client sent an array payload, handle as a batch (no idempotency wrapper)
  let maybeArray: unknown;
  try {
    maybeArray = JSON.parse(rawBody);
  } catch {
    // fall through and let addEvent handle invalid JSON via idempotency path
    maybeArray = null;
  }

  let response: NextResponse;
  if (Array.isArray(maybeArray)) {
    response = await addEventsBatch(request, id, auth.apiKey!, rawBody);
  } else {
    // Handle single event with idempotency
    response = await withIdempotency(request, (req, body) => addEvent(req, id, auth.apiKey!, body));
  }

  recordRequest('POST /api/v1/products/[id]/events', response.status, Date.now() - start);
  return response;
}
