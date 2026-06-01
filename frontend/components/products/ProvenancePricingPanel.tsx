'use client';

import type { Product, TrackingEvent } from '@/lib/types';
import {
  applyProvenancePricing,
  formatPrice,
  DEFAULT_PRICING_RULES,
} from '@/lib/utils/provenancePricing';
import {
  calculateProvenanceScore,
  getProvenanceScorePercentage,
} from '@/lib/utils/provenanceScore';

interface Props {
  product: Product;
  events: TrackingEvent[];
}

/**
 * Displays provenance-adjusted pricing for a product (#479).
 * Shows base price, the active adjustment rule, and the final adjusted price.
 */
export function ProvenancePricingPanel({ product, events }: Props) {
  if (!product.pricing) return null;

  const breakdown = calculateProvenanceScore(events, product);
  const score = getProvenanceScorePercentage(breakdown);
  const rules = product.pricing.adjustmentRules.length
    ? product.pricing.adjustmentRules
    : DEFAULT_PRICING_RULES;
  const result = applyProvenancePricing({ ...product.pricing, adjustmentRules: rules }, score);

  const priceDiff = result.adjustedPrice - result.basePrice;
  const diffSign = priceDiff >= 0 ? '+' : '';
  const diffColor =
    priceDiff > 0
      ? 'text-green-600 dark:text-green-400'
      : priceDiff < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-[var(--muted)]';

  return (
    <section
      aria-labelledby="pricing-panel-heading"
      className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4 space-y-3"
    >
      <h3
        id="pricing-panel-heading"
        className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide"
      >
        Provenance Pricing
      </h3>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">Base price</span>
        <span className="font-mono">{formatPrice(result.basePrice, result.currency)}</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">Provenance score</span>
        <span className="font-mono">{score}%</span>
      </div>

      {result.appliedRule && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Adjustment tier</span>
          <span className="font-medium">{result.appliedRule.label}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">Price adjustment</span>
        <span className={`font-mono ${diffColor}`}>
          {diffSign}{formatPrice(Math.abs(priceDiff), result.currency)}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--card-border)] pt-3">
        <span className="font-semibold text-[var(--foreground)]">Adjusted price</span>
        <span className="text-lg font-bold font-mono text-[var(--foreground)]">
          {formatPrice(result.adjustedPrice, result.currency)}
        </span>
      </div>

      {/* Rule breakdown */}
      <details className="text-xs text-[var(--muted)]">
        <summary className="cursor-pointer hover:text-[var(--foreground)] transition-colors">
          View all adjustment rules
        </summary>
        <ul className="mt-2 space-y-1 pl-2">
          {rules.map((rule) => (
            <li
              key={`${rule.minScore}-${rule.maxScore}`}
              className={
                result.appliedRule?.minScore === rule.minScore
                  ? 'font-semibold text-[var(--foreground)]'
                  : ''
              }
            >
              {rule.label}: {rule.minScore}–{rule.maxScore}% score →{' '}
              {rule.multiplier >= 1
                ? `+${Math.round((rule.multiplier - 1) * 100)}%`
                : `-${Math.round((1 - rule.multiplier) * 100)}%`}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
