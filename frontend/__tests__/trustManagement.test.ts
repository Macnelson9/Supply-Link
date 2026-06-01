import { describe, it, expect } from 'vitest';
import { calculateTrustScore, getTrustBadgeColor } from '@/lib/services/trustManagement';

describe('Trust Management', () => {
  it('should calculate trusted status for high trust weight', () => {
    const trust = {
      actor: 'GTEST123',
      trust_weight: 85,
      blacklisted: false,
      blacklist_reason: '',
      last_updated: Date.now() / 1000,
    };

    const result = calculateTrustScore(trust);
    expect(result.status).toBe('trusted');
    expect(result.score).toBe(85);
  });

  it('should calculate neutral status for medium trust weight', () => {
    const trust = {
      actor: 'GTEST123',
      trust_weight: 60,
      blacklisted: false,
      blacklist_reason: '',
      last_updated: Date.now() / 1000,
    };

    const result = calculateTrustScore(trust);
    expect(result.status).toBe('neutral');
    expect(result.score).toBe(60);
  });

  it('should calculate suspicious status for low trust weight', () => {
    const trust = {
      actor: 'GTEST123',
      trust_weight: 30,
      blacklisted: false,
      blacklist_reason: '',
      last_updated: Date.now() / 1000,
    };

    const result = calculateTrustScore(trust);
    expect(result.status).toBe('suspicious');
    expect(result.score).toBe(30);
  });

  it('should calculate blacklisted status', () => {
    const trust = {
      actor: 'GTEST123',
      trust_weight: 50,
      blacklisted: true,
      blacklist_reason: 'Quality violations',
      last_updated: Date.now() / 1000,
    };

    const result = calculateTrustScore(trust);
    expect(result.status).toBe('blacklisted');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('Quality violations');
  });

  it('should return correct badge colors', () => {
    expect(getTrustBadgeColor('trusted')).toContain('green');
    expect(getTrustBadgeColor('neutral')).toContain('yellow');
    expect(getTrustBadgeColor('suspicious')).toContain('orange');
    expect(getTrustBadgeColor('blacklisted')).toContain('red');
  });
});
