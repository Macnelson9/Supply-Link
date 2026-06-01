/**
 * Provenance-based pricing adjustment logic (#479).
 *
 * Applies PricingAdjustmentRule entries to a product's base price based on
 * the computed provenance score. The first matching rule wins.
 */
import type {
  ProductPricingMetadata,
  PricingAdjustmentRule,
  AdjustedPriceResult,
} from '@/lib/types';

/**
 * Apply provenance-based pricing rules to a base price.
 *
 * @param pricing  - The product's pricing metadata.
 * @param provenanceScore - Provenance score percentage (0–100).
 * @returns AdjustedPriceResult with the final price and the rule that was applied.
 */
export function applyProvenancePricing(
  pricing: ProductPricingMetadata,
  provenanceScore: number,
): AdjustedPriceResult {
  const matchedRule = findMatchingRule(pricing.adjustmentRules, provenanceScore);

  const adjustedPrice = matchedRule
    ? Math.round(pricing.basePrice * matchedRule.multiplier)
    : pricing.basePrice;

  return {
    basePrice: pricing.basePrice,
    currency: pricing.currency,
    adjustedPrice,
    appliedRule: matchedRule,
    provenanceScore,
  };
}

/**
 * Find the first rule whose score range contains the given provenance score.
 */
export function findMatchingRule(
  rules: PricingAdjustmentRule[],
  score: number,
): PricingAdjustmentRule | null {
  return rules.find((r) => score >= r.minScore && score <= r.maxScore) ?? null;
}

/**
 * Format an adjusted price for display (e.g. "$12.50").
 * Assumes basePrice / adjustedPrice are in the smallest currency unit (cents).
 */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

/** Default adjustment rules used when a product has no custom rules. */
export const DEFAULT_PRICING_RULES: PricingAdjustmentRule[] = [
  { minScore: 90, maxScore: 100, multiplier: 1.15, label: 'Premium' },
  { minScore: 75, maxScore: 89,  multiplier: 1.05, label: 'High Quality' },
  { minScore: 60, maxScore: 74,  multiplier: 1.0,  label: 'Standard' },
  { minScore: 45, maxScore: 59,  multiplier: 0.95, label: 'Reduced' },
  { minScore: 0,  maxScore: 44,  multiplier: 0.85, label: 'Discounted' },
];
