import { describe, it, expect } from 'vitest';
import {
  applyProvenancePricing,
  findMatchingRule,
  DEFAULT_PRICING_RULES,
} from '../provenancePricing';
import type { ProductPricingMetadata } from '@/lib/types';

const basePricing: ProductPricingMetadata = {
  basePrice: 1000, // $10.00
  currency: 'USD',
  adjustmentRules: DEFAULT_PRICING_RULES,
};

describe('findMatchingRule', () => {
  it('returns the first rule whose range contains the score', () => {
    const rule = findMatchingRule(DEFAULT_PRICING_RULES, 92);
    expect(rule?.label).toBe('Premium');
  });

  it('returns Standard rule for score 65', () => {
    const rule = findMatchingRule(DEFAULT_PRICING_RULES, 65);
    expect(rule?.label).toBe('Standard');
  });

  it('returns Discounted rule for score 30', () => {
    const rule = findMatchingRule(DEFAULT_PRICING_RULES, 30);
    expect(rule?.label).toBe('Discounted');
  });

  it('returns null when no rule matches', () => {
    const rule = findMatchingRule([], 50);
    expect(rule).toBeNull();
  });
});

describe('applyProvenancePricing', () => {
  it('applies Premium multiplier (1.15) for score 95', () => {
    const result = applyProvenancePricing(basePricing, 95);
    expect(result.adjustedPrice).toBe(1150);
    expect(result.appliedRule?.label).toBe('Premium');
    expect(result.provenanceScore).toBe(95);
  });

  it('applies Discounted multiplier (0.85) for score 20', () => {
    const result = applyProvenancePricing(basePricing, 20);
    expect(result.adjustedPrice).toBe(850);
    expect(result.appliedRule?.label).toBe('Discounted');
  });

  it('returns base price when no rules match', () => {
    const result = applyProvenancePricing({ ...basePricing, adjustmentRules: [] }, 50);
    expect(result.adjustedPrice).toBe(basePricing.basePrice);
    expect(result.appliedRule).toBeNull();
  });

  it('preserves currency in result', () => {
    const result = applyProvenancePricing(basePricing, 80);
    expect(result.currency).toBe('USD');
  });

  it('rounds adjusted price to nearest integer', () => {
    const pricing: ProductPricingMetadata = {
      basePrice: 333,
      currency: 'USD',
      adjustmentRules: [{ minScore: 0, maxScore: 100, multiplier: 1.1, label: 'Test' }],
    };
    const result = applyProvenancePricing(pricing, 50);
    expect(Number.isInteger(result.adjustedPrice)).toBe(true);
  });
});
