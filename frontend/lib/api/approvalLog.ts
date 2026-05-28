/**
 * In-process approval audit log (#424).
 *
 * Records lifecycle events for authorization changes and pending-event
 * approvals so the observability dashboard can surface them.
 *
 * In production this would be persisted to a database or log aggregator.
 * For now it uses a bounded in-memory ring buffer (last 1000 entries).
 */

export type ApprovalAction =
  | 'approve_event'
  | 'reject_event'
  | 'add_authorized_actor'
  | 'remove_authorized_actor'
  | 'transfer_ownership'
  | 'delegate_actor_authority'
  | 'revoke_delegate';

export interface ApprovalLogEntry {
  id: string;
  timestamp: number;
  action: ApprovalAction;
  productId: string;
  actor: string;
  /** Target address (new owner, added/removed actor, delegatee, etc.) */
  target?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Milliseconds from event submission to approval/rejection (for approve/reject only) */
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

const MAX_ENTRIES = 1000;
const log: ApprovalLogEntry[] = [];

export function recordApprovalEvent(entry: Omit<ApprovalLogEntry, 'id' | 'timestamp'>): void {
  const full: ApprovalLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...entry,
  };
  log.push(full);
  if (log.length > MAX_ENTRIES) log.shift();
}

export function getApprovalLog(limit = 100): ApprovalLogEntry[] {
  return log.slice(-limit).reverse();
}

export function getApprovalStats() {
  const now = Date.now();
  const last24h = log.filter((e) => now - e.timestamp < 86_400_000);

  const pendingApprovals = last24h.filter((e) => e.action === 'approve_event' && e.success).length;
  const rejections = last24h.filter((e) => e.action === 'reject_event' && e.success).length;
  const authChanges = last24h.filter(
    (e) =>
      e.action === 'add_authorized_actor' ||
      e.action === 'remove_authorized_actor' ||
      e.action === 'transfer_ownership',
  ).length;

  const latencies = last24h
    .filter((e) => e.latencyMs !== undefined)
    .map((e) => e.latencyMs as number);
  const avgLatencyMs =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  return { pendingApprovals, rejections, authChanges, avgLatencyMs, total: last24h.length };
}
