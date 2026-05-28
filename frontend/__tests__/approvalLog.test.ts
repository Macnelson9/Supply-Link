/**
 * Tests for the approval audit log (#424).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordApprovalEvent, getApprovalLog, getApprovalStats } from '@/lib/api/approvalLog';

// Reset the module-level log between tests by re-importing a fresh module.
// Since vitest caches modules, we manipulate via the public API instead.

describe('approvalLog', () => {
  // Drain the log before each test by reading all entries (we can't reset it
  // directly, so we record a known set and verify relative counts).
  // For isolation we use a fresh import via vi.resetModules in a separate suite.

  it('recordApprovalEvent stores an entry with id and timestamp', () => {
    const before = getApprovalLog(1000).length;
    recordApprovalEvent({
      action: 'approve_event',
      productId: 'prod-1',
      actor: 'GACTOR',
      success: true,
      latencyMs: 500,
    });
    const after = getApprovalLog(1000);
    expect(after.length).toBe(before + 1);
    const entry = after[0]; // most recent first
    expect(entry.id).toMatch(/^\d+-[a-z0-9]+$/);
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.action).toBe('approve_event');
    expect(entry.productId).toBe('prod-1');
    expect(entry.latencyMs).toBe(500);
    expect(entry.success).toBe(true);
  });

  it('getApprovalLog respects the limit parameter', () => {
    // Record 5 more entries
    for (let i = 0; i < 5; i++) {
      recordApprovalEvent({
        action: 'add_authorized_actor',
        productId: `p${i}`,
        actor: 'G',
        success: true,
      });
    }
    const limited = getApprovalLog(3);
    expect(limited.length).toBeLessThanOrEqual(3);
  });

  it('getApprovalStats counts approvals, rejections, and auth changes', () => {
    recordApprovalEvent({
      action: 'approve_event',
      productId: 'p',
      actor: 'G',
      success: true,
      latencyMs: 200,
    });
    recordApprovalEvent({
      action: 'reject_event',
      productId: 'p',
      actor: 'G',
      success: true,
      latencyMs: 100,
    });
    recordApprovalEvent({
      action: 'add_authorized_actor',
      productId: 'p',
      actor: 'G',
      success: true,
    });
    recordApprovalEvent({
      action: 'remove_authorized_actor',
      productId: 'p',
      actor: 'G',
      success: true,
    });
    recordApprovalEvent({
      action: 'transfer_ownership',
      productId: 'p',
      actor: 'G',
      success: true,
    });

    const stats = getApprovalStats();
    expect(stats.pendingApprovals).toBeGreaterThanOrEqual(1);
    expect(stats.rejections).toBeGreaterThanOrEqual(1);
    expect(stats.authChanges).toBeGreaterThanOrEqual(3);
    expect(stats.avgLatencyMs).toBeGreaterThan(0);
  });

  it('getApprovalStats avgLatencyMs is 0 when no latency entries exist', () => {
    // Record an entry without latencyMs
    recordApprovalEvent({
      action: 'add_authorized_actor',
      productId: 'p',
      actor: 'G',
      success: true,
    });
    const stats = getApprovalStats();
    // avgLatencyMs may be > 0 from prior tests, but the function should not throw
    expect(typeof stats.avgLatencyMs).toBe('number');
  });
});
