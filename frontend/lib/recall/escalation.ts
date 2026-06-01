/**
 * Recall escalation workflow (#480).
 *
 * Defines escalation stages, priority levels, and stakeholder notification
 * triggers for product recall events.
 */

export type RecallPriority = 'low' | 'medium' | 'high' | 'critical';

export type EscalationStage =
  | 'initiated'
  | 'under_review'
  | 'stakeholders_notified'
  | 'regulatory_filed'
  | 'resolved';

export interface RecallEscalation {
  id: string;
  productId: string;
  productName: string;
  reason: string;
  priority: RecallPriority;
  stage: EscalationStage;
  initiatedBy: string;
  initiatedAt: number;
  /** Ordered audit trail of stage transitions */
  auditTrail: EscalationAuditEntry[];
  /** Stakeholders notified at each stage */
  notifiedStakeholders: string[];
  resolvedAt?: number;
  resolutionNote?: string;
}

export interface EscalationAuditEntry {
  stage: EscalationStage;
  actor: string;
  timestamp: number;
  note?: string;
}

export interface StakeholderNotification {
  stage: EscalationStage;
  priority: RecallPriority;
  productId: string;
  productName: string;
  reason: string;
  escalationId: string;
  timestamp: string;
}

// ── Stage ordering ────────────────────────────────────────────────────────────

const STAGE_ORDER: EscalationStage[] = [
  'initiated',
  'under_review',
  'stakeholders_notified',
  'regulatory_filed',
  'resolved',
];

export function nextStage(current: EscalationStage): EscalationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

export function isTerminalStage(stage: EscalationStage): boolean {
  return stage === 'resolved';
}

// ── Priority helpers ──────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<RecallPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PRIORITY_BADGE_CLASS: Record<RecallPriority, string> = {
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
  medium:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300',
};

export const STAGE_LABELS: Record<EscalationStage, string> = {
  initiated: 'Initiated',
  under_review: 'Under Review',
  stakeholders_notified: 'Stakeholders Notified',
  regulatory_filed: 'Regulatory Filed',
  resolved: 'Resolved',
};

// ── In-memory store (replace with DB in production) ───────────────────────────

const escalationStore = new Map<string, RecallEscalation>();

export function createEscalation(params: {
  productId: string;
  productName: string;
  reason: string;
  priority: RecallPriority;
  initiatedBy: string;
}): RecallEscalation {
  const id = `esc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const escalation: RecallEscalation = {
    id,
    productId: params.productId,
    productName: params.productName,
    reason: params.reason,
    priority: params.priority,
    stage: 'initiated',
    initiatedBy: params.initiatedBy,
    initiatedAt: now,
    auditTrail: [{ stage: 'initiated', actor: params.initiatedBy, timestamp: now }],
    notifiedStakeholders: [],
  };
  escalationStore.set(id, escalation);
  return escalation;
}

export function advanceEscalation(
  id: string,
  actor: string,
  note?: string,
): RecallEscalation | null {
  const esc = escalationStore.get(id);
  if (!esc || isTerminalStage(esc.stage)) return null;

  const next = nextStage(esc.stage);
  if (!next) return null;

  const now = Date.now();
  esc.stage = next;
  esc.auditTrail.push({ stage: next, actor, timestamp: now, note });

  if (next === 'resolved') {
    esc.resolvedAt = now;
    esc.resolutionNote = note;
  }

  escalationStore.set(id, esc);
  return esc;
}

export function getEscalation(id: string): RecallEscalation | null {
  return escalationStore.get(id) ?? null;
}

export function listEscalations(productId?: string): RecallEscalation[] {
  const all = Array.from(escalationStore.values());
  return productId ? all.filter((e) => e.productId === productId) : all;
}

export function addNotifiedStakeholder(id: string, stakeholder: string): void {
  const esc = escalationStore.get(id);
  if (esc && !esc.notifiedStakeholders.includes(stakeholder)) {
    esc.notifiedStakeholders.push(stakeholder);
    escalationStore.set(id, esc);
  }
}

/** Build a notification payload for a given escalation stage. */
export function buildStakeholderNotification(esc: RecallEscalation): StakeholderNotification {
  return {
    stage: esc.stage,
    priority: esc.priority,
    productId: esc.productId,
    productName: esc.productName,
    reason: esc.reason,
    escalationId: esc.id,
    timestamp: new Date().toISOString(),
  };
}
