/**
 * Recall risk scoring engine.
 *
 * Analyzes a product's event history and metadata to produce an explainable
 * recall risk score. Higher scores indicate greater risk.
 *
 * Risk factors (each contributes a weighted penalty):
 *  - Missing approvals: events with no authorized actor
 *  - Location jumps: geographically implausible rapid transitions
 *  - Delayed stage transitions: gaps between expected lifecycle stages
 *  - Expired metadata: product past its expiration timestamp
 *  - Recalled flag: product has an active recall
 *  - Sparse event coverage: missing expected lifecycle stages
 */

import type { Product, TrackingEvent } from '@/lib/types';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  /** Machine-readable key for this factor. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Penalty points added to the raw score (0–100 scale). */
  penalty: number;
  /** Explanation shown to buyers and auditors. */
  explanation: string;
}

export interface RecallRiskScore {
  productId: string;
  /** 0 = no risk, 100 = maximum risk. */
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  calculatedAt: string;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum expected seconds between consecutive lifecycle stages. */
const STAGE_DELAY_THRESHOLDS: Record<string, Record<string, number>> = {
  HARVEST: { PROCESSING: 3_600, SHIPPING: 86_400, RETAIL: 172_800 },
  PROCESSING: { SHIPPING: 3_600, RETAIL: 86_400 },
  SHIPPING: { RETAIL: 3_600 },
};

/** Maximum realistic seconds between consecutive stages before flagging a delay. */
const STAGE_MAX_GAP: Record<string, Record<string, number>> = {
  HARVEST: { PROCESSING: 30 * 86_400 },   // 30 days
  PROCESSING: { SHIPPING: 14 * 86_400 },  // 14 days
  SHIPPING: { RETAIL: 21 * 86_400 },      // 21 days
};

const EXPECTED_STAGES = ['HARVEST', 'PROCESSING', 'SHIPPING', 'RETAIL'];

// ── Scoring helpers ───────────────────────────────────────────────────────────

function missingApprovalsPenalty(events: TrackingEvent[]): RiskFactor | null {
  // Events with no actor string are suspicious (actor field empty/unknown)
  const missing = events.filter((e) => !e.actor || e.actor.trim() === '').length;
  if (missing === 0) return null;
  const penalty = Math.min(30, missing * 10);
  return {
    key: 'missing_approvals',
    label: 'Missing Approvals',
    penalty,
    explanation: `${missing} event(s) have no recorded actor, indicating possible authorization gaps.`,
  };
}

function locationJumpPenalty(events: TrackingEvent[]): RiskFactor | null {
  if (events.length < 2) return null;
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let jumps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const timeDelta = curr.timestamp - prev.timestamp;
    const minExpected = STAGE_DELAY_THRESHOLDS[prev.eventType]?.[curr.eventType];
    // Flag if transition is faster than the minimum realistic time
    if (minExpected !== undefined && timeDelta < minExpected) {
      jumps++;
    }
  }
  if (jumps === 0) return null;
  const penalty = Math.min(35, jumps * 12);
  return {
    key: 'location_jumps',
    label: 'Unexpected Location Jumps',
    penalty,
    explanation: `${jumps} stage transition(s) occurred faster than physically plausible, suggesting data irregularities.`,
  };
}

function delayedTransitionPenalty(events: TrackingEvent[]): RiskFactor | null {
  if (events.length < 2) return null;
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let delays = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const timeDelta = curr.timestamp - prev.timestamp;
    const maxAllowed = STAGE_MAX_GAP[prev.eventType]?.[curr.eventType];
    if (maxAllowed !== undefined && timeDelta > maxAllowed) {
      delays++;
    }
  }
  if (delays === 0) return null;
  const penalty = Math.min(20, delays * 7);
  return {
    key: 'delayed_transitions',
    label: 'Delayed Stage Transitions',
    penalty,
    explanation: `${delays} stage transition(s) exceeded the expected maximum time window, indicating lifecycle anomalies.`,
  };
}

function expiredMetadataPenalty(product: Product): RiskFactor | null {
  if (!product.expirationTimestamp || product.expirationTimestamp === 0) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec <= product.expirationTimestamp) return null;
  return {
    key: 'expired_metadata',
    label: 'Expired Product Metadata',
    penalty: 25,
    explanation: 'The product has passed its recorded expiration timestamp.',
  };
}

function recalledPenalty(product: Product): RiskFactor | null {
  if (!product.recalled) return null;
  return {
    key: 'active_recall',
    label: 'Active Recall',
    penalty: 50,
    explanation: `Product has an active recall${product.recallReason ? `: "${product.recallReason}"` : ''}.`,
  };
}

function sparseCoveragePenalty(events: TrackingEvent[]): RiskFactor | null {
  const present = new Set(events.map((e) => e.eventType));
  const missing = EXPECTED_STAGES.filter((s) => !present.has(s));
  if (missing.length === 0) return null;
  const penalty = Math.min(20, missing.length * 5);
  return {
    key: 'sparse_coverage',
    label: 'Incomplete Lifecycle Coverage',
    penalty,
    explanation: `Missing lifecycle stages: ${missing.join(', ')}. Incomplete histories reduce auditability.`,
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a recall risk score for a product.
 *
 * The score is the sum of all active penalty factors, capped at 100.
 * Each factor is independently explainable so buyers and auditors can
 * understand exactly why a product is flagged.
 */
export function computeRecallRiskScore(
  product: Product,
  events: TrackingEvent[],
): RecallRiskScore {
  const activeEvents = events.filter((e) => !e.archived);

  const candidates = [
    recalledPenalty(product),
    expiredMetadataPenalty(product),
    missingApprovalsPenalty(activeEvents),
    locationJumpPenalty(activeEvents),
    delayedTransitionPenalty(activeEvents),
    sparseCoveragePenalty(activeEvents),
  ];

  const factors = candidates.filter((f): f is RiskFactor => f !== null);
  const score = Math.min(100, factors.reduce((sum, f) => sum + f.penalty, 0));

  return {
    productId: product.id,
    score,
    level: scoreToLevel(score),
    factors,
    calculatedAt: new Date().toISOString(),
  };
}

/** Tailwind color class for a risk level. */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'text-red-600 dark:text-red-400';
    case 'high':     return 'text-orange-600 dark:text-orange-400';
    case 'medium':   return 'text-yellow-600 dark:text-yellow-400';
    case 'low':      return 'text-green-600 dark:text-green-400';
  }
}

/** Tailwind background + border class for a risk level. */
export function getRiskLevelBg(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
    case 'high':     return 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800';
    case 'medium':   return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
    case 'low':      return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
  }
}
