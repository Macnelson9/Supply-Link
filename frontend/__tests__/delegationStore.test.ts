/**
 * Tests for the delegation store and API routes (#422).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { delegationStore } from '@/lib/services/delegationStore';
import type { Delegation } from '@/lib/types';

const FUTURE = Math.floor(Date.now() / 1000) + 86400;

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    delegationId: Date.now() + Math.random(),
    productId: 'prod-1',
    delegator: 'GDELEGATOR',
    delegatee: 'GDELEGATEE',
    expiresAt: FUTURE,
    revoked: false,
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe('delegationStore', () => {
  beforeEach(() => {
    delegationStore._clear();
  });

  it('list returns empty array for unknown product', () => {
    expect(delegationStore.list('unknown')).toEqual([]);
  });

  it('add stores a delegation and list returns it', () => {
    const d = makeDelegation();
    delegationStore.add(d);
    expect(delegationStore.list('prod-1')).toHaveLength(1);
    expect(delegationStore.list('prod-1')[0].delegatee).toBe('GDELEGATEE');
  });

  it('revoke marks a delegation as revoked', () => {
    const d = makeDelegation({ delegationId: 42 });
    delegationStore.add(d);
    const revoked = delegationStore.revoke('prod-1', 42);
    expect(revoked).not.toBeNull();
    expect(revoked!.revoked).toBe(true);
    expect(delegationStore.list('prod-1')[0].revoked).toBe(true);
  });

  it('revoke returns null for unknown delegationId', () => {
    const d = makeDelegation({ delegationId: 99 });
    delegationStore.add(d);
    expect(delegationStore.revoke('prod-1', 999)).toBeNull();
  });

  it('revoke returns null for unknown productId', () => {
    expect(delegationStore.revoke('no-such-product', 1)).toBeNull();
  });

  it('multiple delegations for same product are stored independently', () => {
    delegationStore.add(makeDelegation({ delegationId: 1, delegatee: 'GA' }));
    delegationStore.add(makeDelegation({ delegationId: 2, delegatee: 'GB' }));
    expect(delegationStore.list('prod-1')).toHaveLength(2);
    delegationStore.revoke('prod-1', 1);
    const list = delegationStore.list('prod-1');
    expect(list.find((d) => d.delegationId === 1)!.revoked).toBe(true);
    expect(list.find((d) => d.delegationId === 2)!.revoked).toBe(false);
  });
});
