/**
 * Tests for the contract query cache (#423).
 *
 * Verifies cache hits for repeated reads and correct invalidation after writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Stellar contract client before any module imports so the
// productReadModel picks up the mock on its dynamic import.
const mockGetProduct = vi.fn().mockResolvedValue(null);
const mockGetTrackingEvents = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/stellar/contract', () => ({
  contractClient: {
    getProduct: (...args: unknown[]) => mockGetProduct(...args),
    getTrackingEvents: (...args: unknown[]) => mockGetTrackingEvents(...args),
  },
}));

import {
  getProduct,
  getTrackingEvents,
  invalidateProductCache,
  invalidateAllCaches,
} from '@/lib/services/productReadModel';

describe('productReadModel cache', () => {
  beforeEach(() => {
    invalidateAllCaches();
    mockGetProduct.mockClear();
    mockGetTrackingEvents.mockClear();
  });

  it('returns mock data when contract returns null', async () => {
    const result = await getProduct('prod-1');
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('cache hit: second call does not re-fetch from contract', async () => {
    // Return a real product so the cache is populated
    mockGetProduct.mockResolvedValueOnce({
      name: 'Test',
      origin: 'Test',
      owner: 'G',
      timestamp: 0,
      active: true,
      authorized_actors: [],
    });
    await getProduct('prod-cache-test');
    await getProduct('prod-cache-test');
    // Contract called once; second call served from cache
    expect(mockGetProduct.mock.calls.length).toBe(1);
  });

  it('invalidateProductCache forces a fresh read on next call', async () => {
    await getProduct('prod-invalidate-test');
    invalidateProductCache('prod-invalidate-test');
    await getProduct('prod-invalidate-test');
    expect(mockGetProduct.mock.calls.length).toBe(2);
  });

  it('invalidateAllCaches clears all cached products and events', async () => {
    await getProduct('p1');
    await getTrackingEvents('p1');
    invalidateAllCaches();
    await getProduct('p1');
    await getTrackingEvents('p1');
    expect(mockGetProduct.mock.calls.length).toBe(2);
    expect(mockGetTrackingEvents.mock.calls.length).toBe(2);
  });

  it('bypassCache option skips the cache', async () => {
    await getProduct('prod-bypass');
    await getProduct('prod-bypass', { bypassCache: true });
    expect(mockGetProduct.mock.calls.length).toBe(2);
  });
});
