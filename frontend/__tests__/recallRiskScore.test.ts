import { describe, it, expect } from 'vitest';
import {
  computeRecallRiskScore,
  getRiskLevelColor,
  getRiskLevelBg,
} from '@/lib/services/recallRiskScore';
import type { Product, TrackingEvent } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW_SEC = Math.floor(Date.now() / 1000);

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-001',
    name: 'Test Product',
    origin: 'Test Origin',
    owner: 'GOWNER1',
    timestamp: NOW_SEC - 86_400,
    active: true,
    authorizedActors: ['GACTOR1'],
    recalled: false,
    ...overrides,
  };
}

function makeEvent(
  eventType: TrackingEvent['eventType'],
  timestamp: number,
  overrides: Partial<TrackingEvent> = {},
): TrackingEvent {
  return {
    productId: 'prod-001',
    location: 'Warehouse A',
    actor: 'GACTOR1',
    timestamp,
    eventType,
    metadata: '{}',
    stableId: `stable-${eventType}-${timestamp}`,
    ...overrides,
  };
}

// ── computeRecallRiskScore ────────────────────────────────────────────────────

describe('computeRecallRiskScore', () => {
  it('returns score 0 and level low for a clean product with full lifecycle', () => {
    const product = makeProduct();
    const events = [
      makeEvent('HARVEST',    NOW_SEC - 10 * 86_400),
      makeEvent('PROCESSING', NOW_SEC - 8  * 86_400),
      makeEvent('SHIPPING',   NOW_SEC - 5  * 86_400),
      makeEvent('RETAIL',     NOW_SEC - 2  * 86_400),
    ];
    const result = computeRecallRiskScore(product, events);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  it('adds active_recall penalty for recalled products', () => {
    const product = makeProduct({ recalled: true, recallReason: 'contamination' });
    const result = computeRecallRiskScore(product, []);
    const factor = result.factors.find((f) => f.key === 'active_recall');
    expect(factor).toBeDefined();
    expect(factor!.penalty).toBe(50);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.level).toBe('critical');
  });

  it('adds expired_metadata penalty when product is past expiration', () => {
    const product = makeProduct({ expirationTimestamp: NOW_SEC - 1000 });
    const result = computeRecallRiskScore(product, []);
    const factor = result.factors.find((f) => f.key === 'expired_metadata');
    expect(factor).toBeDefined();
    expect(factor!.penalty).toBe(25);
  });

  it('does not add expired_metadata penalty when product is not yet expired', () => {
    const product = makeProduct({ expirationTimestamp: NOW_SEC + 86_400 });
    const result = computeRecallRiskScore(product, []);
    expect(result.factors.find((f) => f.key === 'expired_metadata')).toBeUndefined();
  });

  it('adds missing_approvals penalty for events with no actor', () => {
    const product = makeProduct();
    const events = [
      makeEvent('HARVEST', NOW_SEC - 5 * 86_400, { actor: '' }),
      makeEvent('RETAIL',  NOW_SEC - 1 * 86_400),
    ];
    const result = computeRecallRiskScore(product, events);
    const factor = result.factors.find((f) => f.key === 'missing_approvals');
    expect(factor).toBeDefined();
    expect(factor!.penalty).toBeGreaterThan(0);
  });

  it('adds location_jumps penalty for impossibly fast transitions', () => {
    const product = makeProduct();
    // HARVEST → PROCESSING in 10 seconds (minimum is 3600)
    const events = [
      makeEvent('HARVEST',    NOW_SEC - 100),
      makeEvent('PROCESSING', NOW_SEC - 90),
    ];
    const result = computeRecallRiskScore(product, events);
    const factor = result.factors.find((f) => f.key === 'location_jumps');
    expect(factor).toBeDefined();
    expect(factor!.penalty).toBeGreaterThan(0);
  });

  it('adds delayed_transitions penalty for excessively slow transitions', () => {
    const product = makeProduct();
    // HARVEST → PROCESSING after 40 days (max is 30 days)
    const events = [
      makeEvent('HARVEST',    NOW_SEC - 41 * 86_400),
      makeEvent('PROCESSING', NOW_SEC - 1  * 86_400),
    ];
    const result = computeRecallRiskScore(product, events);
    const factor = result.factors.find((f) => f.key === 'delayed_transitions');
    expect(factor).toBeDefined();
  });

  it('adds sparse_coverage penalty when lifecycle stages are missing', () => {
    const product = makeProduct();
    const events = [makeEvent('HARVEST', NOW_SEC - 5 * 86_400)];
    const result = computeRecallRiskScore(product, events);
    const factor = result.factors.find((f) => f.key === 'sparse_coverage');
    expect(factor).toBeDefined();
    expect(factor!.explanation).toContain('PROCESSING');
  });

  it('caps score at 100 even with many overlapping penalties', () => {
    const product = makeProduct({
      recalled: true,
      expirationTimestamp: NOW_SEC - 1000,
    });
    const events = [
      makeEvent('HARVEST', NOW_SEC - 10, { actor: '' }),
      makeEvent('PROCESSING', NOW_SEC - 5, { actor: '' }),
    ];
    const result = computeRecallRiskScore(product, events);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('excludes archived events from analysis', () => {
    const product = makeProduct();
    const events = [
      makeEvent('HARVEST', NOW_SEC - 10, { archived: true, actor: '' }),
      makeEvent('RETAIL',  NOW_SEC - 5),
    ];
    const result = computeRecallRiskScore(product, events);
    // Archived event with no actor should not trigger missing_approvals
    expect(result.factors.find((f) => f.key === 'missing_approvals')).toBeUndefined();
  });

  it('returns correct productId in result', () => {
    const product = makeProduct({ id: 'my-product' });
    const result = computeRecallRiskScore(product, []);
    expect(result.productId).toBe('my-product');
  });
});

// ── Level thresholds ──────────────────────────────────────────────────────────

describe('risk level thresholds', () => {
  it('score 0 → low', () => {
    const result = computeRecallRiskScore(makeProduct(), [
      makeEvent('HARVEST',    NOW_SEC - 10 * 86_400),
      makeEvent('PROCESSING', NOW_SEC - 8  * 86_400),
      makeEvent('SHIPPING',   NOW_SEC - 5  * 86_400),
      makeEvent('RETAIL',     NOW_SEC - 2  * 86_400),
    ]);
    expect(result.level).toBe('low');
  });

  it('score ≥ 70 → critical', () => {
    const product = makeProduct({ recalled: true, expirationTimestamp: NOW_SEC - 1 });
    const result = computeRecallRiskScore(product, []);
    expect(result.level).toBe('critical');
  });
});

// ── Color helpers ─────────────────────────────────────────────────────────────

describe('getRiskLevelColor', () => {
  it('returns red for critical', () => {
    expect(getRiskLevelColor('critical')).toContain('red');
  });
  it('returns green for low', () => {
    expect(getRiskLevelColor('low')).toContain('green');
  });
});

describe('getRiskLevelBg', () => {
  it('returns orange bg for high', () => {
    expect(getRiskLevelBg('high')).toContain('orange');
  });
});
