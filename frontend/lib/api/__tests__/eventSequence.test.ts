import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getEventSequence,
  claimEventSequence,
  resetEventSequence,
  EventSequenceConflictError,
} from '../eventSequence';
import { kvStore } from '@/lib/kv';

// Use the real in-memory KV store (no KV_REST_API_URL set in tests)
beforeEach(async () => {
  await resetEventSequence('prod-test');
});

describe('getEventSequence', () => {
  it('returns nextSeq=0 for a product with no history', async () => {
    const seq = await getEventSequence('prod-new');
    expect(seq.nextSeq).toBe(0);
    expect(seq.lastEventAt).toBe(0);
  });
});

describe('claimEventSequence', () => {
  it('accepts seq=0 for a fresh product and increments to 1', async () => {
    const accepted = await claimEventSequence('prod-test', 0);
    expect(accepted).toBe(0);

    const after = await getEventSequence('prod-test');
    expect(after.nextSeq).toBe(1);
  });

  it('accepts sequential claims correctly', async () => {
    await claimEventSequence('prod-test', 0);
    await claimEventSequence('prod-test', 1);
    const seq = await getEventSequence('prod-test');
    expect(seq.nextSeq).toBe(2);
  });

  it('throws EventSequenceConflictError when seq is stale', async () => {
    await claimEventSequence('prod-test', 0); // nextSeq is now 1

    await expect(claimEventSequence('prod-test', 0)).rejects.toThrow(EventSequenceConflictError);
  });

  it('conflict error contains expected and received seq numbers', async () => {
    await claimEventSequence('prod-test', 0);

    try {
      await claimEventSequence('prod-test', 0);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EventSequenceConflictError);
      const conflict = (err as EventSequenceConflictError).conflict;
      expect(conflict.expectedSeq).toBe(1);
      expect(conflict.receivedSeq).toBe(0);
    }
  });

  it('throws when seq is ahead of current nextSeq', async () => {
    await expect(claimEventSequence('prod-test', 5)).rejects.toThrow(EventSequenceConflictError);
  });
});

describe('resetEventSequence', () => {
  it('resets nextSeq back to 0', async () => {
    await claimEventSequence('prod-test', 0);
    await resetEventSequence('prod-test');
    const seq = await getEventSequence('prod-test');
    expect(seq.nextSeq).toBe(0);
  });
});
