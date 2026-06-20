/**
 * POST /api/v1/insurance/premium – calculate real-time premium quote
 * GET  /api/v1/insurance/premium – list available providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, handleOptions } from '@/lib/api/cors';
import { apiError, withCorrelationId, ErrorCode } from '@/lib/api/errors';
import { applyRateLimit, RATE_LIMIT_PRESETS } from '@/lib/api/rateLimit';
import { authenticateApiRequest } from '@/lib/api/auth';
import { recordRequest } from '@/lib/api/metrics';
import {
  assessRisk,
  calculatePremium,
  listProviders,
  getProvider,
} from '@/lib/services/insuranceCoverage';

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

const PremiumQuoteSchema = z.object({
  productId: z.string().min(1),
  provider: z.string().min(1),
  coverageType: z.string().min(1),
  coverageAmount: z.number().int().positive(),
  currency: z.string().length(3),
  productValue: z.number().nonnegative().default(0),
  hasRecallHistory: z.boolean().default(false),
  transitRiskScore: z.number().min(0).max(10).default(3),
  certificationCount: z.number().int().nonnegative().default(0),
  storageRiskScore: z.number().min(0).max(10).default(3),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'GET /api/v1/insurance/premium',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.authenticated,
  );
  if (limited) {
    recordRequest('GET /api/v1/insurance/premium', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) {
    recordRequest('GET /api/v1/insurance/premium', 401, Date.now() - start);
    return auth.error;
  }

  const providers = listProviders();
  recordRequest('GET /api/v1/insurance/premium', 200, Date.now() - start);
  return withCors(
    request,
    withCorrelationId(
      request,
      NextResponse.json({ providers, total: providers.length }, { status: 200 }),
    ),
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = applyRateLimit(
    request,
    'POST /api/v1/insurance/premium',
    RATE_LIMIT_PRESETS.publicRead,
    RATE_LIMIT_PRESETS.authenticated,
  );
  if (limited) {
    recordRequest('POST /api/v1/insurance/premium', 429, Date.now() - start);
    return limited;
  }

  const auth = await authenticateApiRequest(request, 'partner');
  if (auth.error) {
    recordRequest('POST /api/v1/insurance/premium', 401, Date.now() - start);
    return auth.error;
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

  const parsed = PremiumQuoteSchema.safeParse(body);
  if (!parsed.success) {
    recordRequest('POST /api/v1/insurance/premium', 422, Date.now() - start);
    return withCors(
      request,
      apiError(request, 422, ErrorCode.VALIDATION_ERROR, 'Validation failed', {
        details: parsed.error.flatten(),
      }),
    );
  }

  const providerConfig = getProvider(parsed.data.provider);
  if (!providerConfig) {
    recordRequest('POST /api/v1/insurance/premium', 404, Date.now() - start);
    return withCors(
      request,
      apiError(
        request,
        404,
        ErrorCode.VALIDATION_ERROR,
        `Unknown provider: ${parsed.data.provider}`,
      ),
    );
  }

  const risk = assessRisk({
    productId: parsed.data.productId,
    productValue: parsed.data.productValue,
    hasRecallHistory: parsed.data.hasRecallHistory,
    transitRiskScore: parsed.data.transitRiskScore,
    certificationCount: parsed.data.certificationCount,
    storageRiskScore: parsed.data.storageRiskScore,
  });

  const quote = calculatePremium({
    productId: parsed.data.productId,
    provider: parsed.data.provider,
    coverageType: parsed.data.coverageType,
    coverageAmount: parsed.data.coverageAmount,
    currency: parsed.data.currency,
    riskAssessment: risk,
  });

  recordRequest('POST /api/v1/insurance/premium', 200, Date.now() - start);
  return withCors(
    request,
    withCorrelationId(request, NextResponse.json({ quote, riskAssessment: risk }, { status: 200 })),
  );
}
