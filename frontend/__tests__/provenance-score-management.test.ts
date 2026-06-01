/**
 * Tests for Provenance Score Management (#507)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProvenanceScore,
  setProvenanceScore,
  getProvenanceScore,
  getProvenanceScoreHistory,
  updateProvenanceScore,
  getScoreInterpretation,
  getScoreColor,
  verifyScoreConsistency,
} from '@/lib/provenance/score-management';

// Mock contract client
const mockClient = {
  set_provenance_score: vi.fn(),
  get_provenance_score: vi.fn(),
  get_provenance_score_history: vi.fn(),
};

describe('Provenance Score Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateProvenanceScore', () => {
    it('should calculate score based on event count', () => {
      expect(calculateProvenanceScore(0)).toBe(50);
      expect(calculateProvenanceScore(5)).toBe(75);
      expect(calculateProvenanceScore(10)).toBe(100);
      expect(calculateProvenanceScore(20)).toBe(100); // capped at 100
    });

    it('should return valid range (0-100)', () => {
      for (let i = 0; i <= 20; i++) {
        const score = calculateProvenanceScore(i);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('setProvenanceScore', () => {
    it('should set score successfully', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 85,
        last_calculated_at: 1234567890,
        verified_event_count: 10,
        schema_version: 1,
      };
      mockClient.set_provenance_score.mockResolvedValue(scoreData);

      const result = await setProvenanceScore(mockClient as any, 'prod-001', 85, 10);

      expect(result.productId).toBe('prod-001');
      expect(result.score).toBe(85);
      expect(result.verifiedEventCount).toBe(10);
    });

    it('should reject invalid scores', async () => {
      await expect(setProvenanceScore(mockClient as any, 'prod-001', 101, 10)).rejects.toThrow(
        'Provenance score must be between 0 and 100',
      );

      await expect(setProvenanceScore(mockClient as any, 'prod-001', -1, 10)).rejects.toThrow(
        'Provenance score must be between 0 and 100',
      );
    });

    it('should handle product not found error', async () => {
      mockClient.set_provenance_score.mockRejectedValue(new Error('product not found'));

      await expect(setProvenanceScore(mockClient as any, 'unknown', 50, 5)).rejects.toThrow(
        'Product unknown not found',
      );
    });
  });

  describe('getProvenanceScore', () => {
    it('should retrieve score successfully', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 85,
        last_calculated_at: 1234567890,
        verified_event_count: 10,
        schema_version: 1,
      };
      mockClient.get_provenance_score.mockResolvedValue(scoreData);

      const result = await getProvenanceScore(mockClient as any, 'prod-001');

      expect(result).toEqual({
        productId: 'prod-001',
        score: 85,
        lastCalculatedAt: 1234567890,
        verifiedEventCount: 10,
        schemaVersion: 1,
      });
    });

    it('should return null if score not set', async () => {
      mockClient.get_provenance_score.mockResolvedValue(null);

      const result = await getProvenanceScore(mockClient as any, 'prod-001');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockClient.get_provenance_score.mockRejectedValue(new Error('Network error'));

      const result = await getProvenanceScore(mockClient as any, 'prod-001');

      expect(result).toBeNull();
    });
  });

  describe('getProvenanceScoreHistory', () => {
    it('should retrieve score history', async () => {
      const history = [
        {
          product_id: 'prod-001',
          score: 75,
          last_calculated_at: 1234567890,
          verified_event_count: 5,
          schema_version: 1,
        },
        {
          product_id: 'prod-001',
          score: 85,
          last_calculated_at: 1234567900,
          verified_event_count: 10,
          schema_version: 1,
        },
      ];
      mockClient.get_provenance_score_history.mockResolvedValue(history);

      const result = await getProvenanceScoreHistory(mockClient as any, 'prod-001');

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(75);
      expect(result[1].score).toBe(85);
    });

    it('should return empty array if no history', async () => {
      mockClient.get_provenance_score_history.mockResolvedValue([]);

      const result = await getProvenanceScoreHistory(mockClient as any, 'prod-001');

      expect(result).toEqual([]);
    });
  });

  describe('updateProvenanceScore', () => {
    it('should update score based on event count', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 75,
        last_calculated_at: 1234567890,
        verified_event_count: 5,
        schema_version: 1,
      };
      mockClient.set_provenance_score.mockResolvedValue(scoreData);

      const result = await updateProvenanceScore(mockClient as any, 'prod-001', 5);

      expect(result.score).toBe(75);
      expect(result.verifiedEventCount).toBe(5);
    });
  });

  describe('getScoreInterpretation', () => {
    it('should return correct interpretation', () => {
      expect(getScoreInterpretation(95)).toBe('Excellent');
      expect(getScoreInterpretation(80)).toBe('Good');
      expect(getScoreInterpretation(65)).toBe('Fair');
      expect(getScoreInterpretation(45)).toBe('Poor');
      expect(getScoreInterpretation(20)).toBe('Very Poor');
    });
  });

  describe('getScoreColor', () => {
    it('should return correct color', () => {
      expect(getScoreColor(95)).toBe('#10b981'); // green
      expect(getScoreColor(80)).toBe('#3b82f6'); // blue
      expect(getScoreColor(65)).toBe('#f59e0b'); // amber
      expect(getScoreColor(45)).toBe('#ef4444'); // red
      expect(getScoreColor(20)).toBe('#7f1d1d'); // dark red
    });
  });

  describe('verifyScoreConsistency', () => {
    it('should verify score consistency', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 85,
        last_calculated_at: 1234567890,
        verified_event_count: 10,
        schema_version: 1,
      };
      mockClient.get_provenance_score.mockResolvedValue(scoreData);

      const result = await verifyScoreConsistency(mockClient as any, 'prod-001', 1);

      expect(result).toBe(true);
    });

    it('should detect schema version mismatch', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 85,
        last_calculated_at: 1234567890,
        verified_event_count: 10,
        schema_version: 2,
      };
      mockClient.get_provenance_score.mockResolvedValue(scoreData);

      const result = await verifyScoreConsistency(mockClient as any, 'prod-001', 1);

      expect(result).toBe(false);
    });

    it('should detect invalid score range', async () => {
      const scoreData = {
        product_id: 'prod-001',
        score: 150,
        last_calculated_at: 1234567890,
        verified_event_count: 10,
        schema_version: 1,
      };
      mockClient.get_provenance_score.mockResolvedValue(scoreData);

      const result = await verifyScoreConsistency(mockClient as any, 'prod-001', 1);

      expect(result).toBe(false);
    });

    it('should return true if no score exists', async () => {
      mockClient.get_provenance_score.mockResolvedValue(null);

      const result = await verifyScoreConsistency(mockClient as any, 'prod-001', 1);

      expect(result).toBe(true);
    });
  });
});
