'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import {
  computeRecallRiskScore,
  getRiskLevelColor,
  getRiskLevelBg,
  type RecallRiskScore,
  type RiskLevel,
} from '@/lib/services/recallRiskScore';
import type { Product, TrackingEvent } from '@/lib/types';

interface RecallRiskBadgeProps {
  product: Product;
  events: TrackingEvent[];
  /** Show full breakdown panel instead of compact badge. */
  expanded?: boolean;
}

const LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

function RiskIcon({ level, size = 16 }: { level: RiskLevel; size?: number }) {
  if (level === 'low') return <ShieldCheck size={size} aria-hidden="true" />;
  if (level === 'critical') return <AlertTriangle size={size} aria-hidden="true" />;
  return <ShieldAlert size={size} aria-hidden="true" />;
}

/** Compact inline badge — suitable for product cards and list rows. */
function CompactBadge({ score }: { score: RecallRiskScore }) {
  const colorClass = getRiskLevelColor(score.level);
  const bgClass = getRiskLevelBg(score.level);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${bgClass} ${colorClass}`}
      aria-label={`Recall risk: ${LEVEL_LABELS[score.level]}, score ${score.score}`}
    >
      <RiskIcon level={score.level} size={12} />
      {LEVEL_LABELS[score.level]}
    </span>
  );
}

/** Expanded panel — suitable for product detail and verification pages. */
function ExpandedPanel({ score }: { score: RecallRiskScore }) {
  const colorClass = getRiskLevelColor(score.level);
  const bgClass = getRiskLevelBg(score.level);

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`} role="region" aria-label="Recall risk assessment">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiskIcon level={score.level} size={20} />
          <span className={`font-semibold text-sm ${colorClass}`}>
            Recall Risk — {LEVEL_LABELS[score.level]}
          </span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${colorClass}`} aria-label={`Risk score ${score.score} out of 100`}>
          {score.score}
          <span className="text-sm font-normal opacity-60">/100</span>
        </span>
      </div>

      {/* Score bar */}
      <div
        className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 mb-4 overflow-hidden"
        role="progressbar"
        aria-valuenow={score.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Risk score gauge"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            score.level === 'critical' ? 'bg-red-500' :
            score.level === 'high'     ? 'bg-orange-500' :
            score.level === 'medium'   ? 'bg-yellow-500' :
                                         'bg-green-500'
          }`}
          style={{ width: `${score.score}%` }}
        />
      </div>

      {/* Factors */}
      {score.factors.length === 0 ? (
        <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
          <ShieldCheck size={13} aria-hidden="true" />
          No risk factors detected. History appears consistent.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Risk factors">
          {score.factors.map((f) => (
            <li key={f.key} className="flex items-start gap-2 text-xs">
              <Info size={13} className="mt-0.5 shrink-0 opacity-60" aria-hidden="true" />
              <div>
                <span className="font-medium">{f.label}</span>
                <span className="opacity-75"> — {f.explanation}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs opacity-50">
        Calculated {new Date(score.calculatedAt).toLocaleString()}
      </p>
    </div>
  );
}

export function RecallRiskBadge({ product, events, expanded = false }: RecallRiskBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const score = computeRecallRiskScore(product, events);

  if (expanded) {
    return <ExpandedPanel score={score} />;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-expanded={showTooltip}
        aria-haspopup="true"
        className="cursor-help"
      >
        <CompactBadge score={score} />
      </button>

      {showTooltip && score.factors.length > 0 && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 z-20 w-72 rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3 shadow-lg text-xs text-[var(--foreground)]"
        >
          <p className="font-semibold mb-2">Risk Factors</p>
          <ul className="space-y-1.5">
            {score.factors.map((f) => (
              <li key={f.key} className="text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">{f.label}:</span>{' '}
                {f.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
