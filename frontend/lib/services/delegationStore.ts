/**
 * Shared in-memory delegation store.
 * In production, replace with a database-backed implementation.
 */

import type { Delegation } from '@/lib/types';

const store = new Map<string, Delegation[]>();

export const delegationStore = {
  list(productId: string): Delegation[] {
    return store.get(productId) ?? [];
  },
  add(delegation: Delegation): void {
    const existing = store.get(delegation.productId) ?? [];
    store.set(delegation.productId, [...existing, delegation]);
  },
  revoke(productId: string, delegationId: number): Delegation | null {
    const delegations = store.get(productId);
    if (!delegations) return null;
    const idx = delegations.findIndex((d) => d.delegationId === delegationId);
    if (idx === -1) return null;
    delegations[idx] = { ...delegations[idx], revoked: true };
    store.set(productId, delegations);
    return delegations[idx];
  },
  /** Clear all entries — for testing only. */
  _clear(): void {
    store.clear();
  },
};
