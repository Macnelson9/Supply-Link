/**
 * Tests for Product Identifier Canonicalization (#508)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeProductId,
  registerProductAlias,
  isCanonicalId,
  getProductAliases,
  normalizeProductIds,
  deduplicateProductIds,
} from '@/lib/stellar/identifier-canonicalization';

// Mock contract client
const mockClient = {
  resolve_product_id: vi.fn(),
  register_product_alias: vi.fn(),
  get_product_aliases: vi.fn(),
};

describe('Identifier Canonicalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeProductId', () => {
    it('should resolve alias to canonical ID', async () => {
      mockClient.resolve_product_id.mockResolvedValue('prod-001');

      const result = await normalizeProductId(mockClient as any, 'sku-123');

      expect(result).toBe('prod-001');
      expect(mockClient.resolve_product_id).toHaveBeenCalledWith({ id: 'sku-123' });
    });

    it('should return canonical ID unchanged', async () => {
      mockClient.resolve_product_id.mockResolvedValue('prod-001');

      const result = await normalizeProductId(mockClient as any, 'prod-001');

      expect(result).toBe('prod-001');
    });

    it('should handle resolution errors gracefully', async () => {
      mockClient.resolve_product_id.mockRejectedValue(new Error('Network error'));

      const result = await normalizeProductId(mockClient as any, 'unknown-id');

      expect(result).toBe('unknown-id');
    });
  });

  describe('registerProductAlias', () => {
    it('should register alias successfully', async () => {
      const aliasEntry = {
        canonical_id: 'prod-001',
        alias: 'sku-123',
        created_by: 'GXXX',
        created_at: 1234567890,
      };
      mockClient.register_product_alias.mockResolvedValue(aliasEntry);

      const result = await registerProductAlias(mockClient as any, 'prod-001', 'sku-123', 'GXXX');

      expect(result).toEqual(aliasEntry);
      expect(mockClient.register_product_alias).toHaveBeenCalledWith({
        canonical_id: 'prod-001',
        alias: 'sku-123',
        creator: 'GXXX',
      });
    });

    it('should throw error on duplicate alias', async () => {
      mockClient.register_product_alias.mockRejectedValue(new Error('alias already exists'));

      await expect(
        registerProductAlias(mockClient as any, 'prod-001', 'sku-123', 'GXXX'),
      ).rejects.toThrow('Alias "sku-123" is already registered');
    });
  });

  describe('isCanonicalId', () => {
    it('should return true for canonical ID', async () => {
      mockClient.resolve_product_id.mockResolvedValue('prod-001');

      const result = await isCanonicalId(mockClient as any, 'prod-001');

      expect(result).toBe(true);
    });

    it('should return false for alias', async () => {
      mockClient.resolve_product_id.mockResolvedValue('prod-001');

      const result = await isCanonicalId(mockClient as any, 'sku-123');

      expect(result).toBe(false);
    });
  });

  describe('getProductAliases', () => {
    it('should return list of aliases', async () => {
      mockClient.get_product_aliases.mockResolvedValue(['sku-123', 'sku-456']);

      const result = await getProductAliases(mockClient as any, 'prod-001');

      expect(result).toEqual(['sku-123', 'sku-456']);
    });

    it('should return empty array on error', async () => {
      mockClient.get_product_aliases.mockRejectedValue(new Error('Network error'));

      const result = await getProductAliases(mockClient as any, 'prod-001');

      expect(result).toEqual([]);
    });
  });

  describe('normalizeProductIds', () => {
    it('should normalize multiple IDs', async () => {
      mockClient.resolve_product_id
        .mockResolvedValueOnce('prod-001')
        .mockResolvedValueOnce('prod-001')
        .mockResolvedValueOnce('prod-002');

      const result = await normalizeProductIds(mockClient as any, [
        'sku-123',
        'prod-001',
        'sku-456',
      ]);

      expect(result).toEqual(['prod-001', 'prod-001', 'prod-002']);
    });
  });

  describe('deduplicateProductIds', () => {
    it('should deduplicate and normalize IDs', async () => {
      mockClient.resolve_product_id
        .mockResolvedValueOnce('prod-001')
        .mockResolvedValueOnce('prod-001')
        .mockResolvedValueOnce('prod-002');

      const result = await deduplicateProductIds(mockClient as any, [
        'sku-123',
        'prod-001',
        'sku-456',
      ]);

      expect(result).toHaveLength(2);
      expect(result).toContain('prod-001');
      expect(result).toContain('prod-002');
    });
  });
});
