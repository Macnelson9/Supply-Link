import { describe, it, expect } from 'vitest';
import {
  validateProvenanceBadge,
  getBadgeCredibilityScore,
  getValidBadges,
  isBadgeExpiringSoon,
} from '@/lib/services/badgeIssuerRegistry';

describe('Badge Issuer Registry', () => {
  const mockIssuer = {
    issuer: 'GISSUER1',
    issuer_name: 'Organic Certifier',
    badge_type: 'ORGANIC',
    trusted: true,
    registered_at: 1000,
  };

  const mockBadge = {
    badge_id: 'badge-1',
    product_id: 'prod-1',
    issuer: 'GISSUER1',
    badge_type: 'ORGANIC',
    issued_at: 1000,
    expires_at: 5000,
    revoked: false,
  };

  const currentTimestamp = 3000;

  it('should validate valid badge', () => {
    const result = validateProvenanceBadge(mockBadge, mockIssuer, currentTimestamp);

    expect(result.valid).toBe(true);
    expect(result.reason).toBe('Badge is valid');
    expect(result.issuer_trusted).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.revoked).toBe(false);
  });

  it('should detect expired badge', () => {
    const expiredBadge = { ...mockBadge, expires_at: 2000 };
    const result = validateProvenanceBadge(expiredBadge, mockIssuer, currentTimestamp);

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.reason).toContain('expired');
  });

  it('should detect revoked badge', () => {
    const revokedBadge = { ...mockBadge, revoked: true };
    const result = validateProvenanceBadge(revokedBadge, mockIssuer, currentTimestamp);

    expect(result.valid).toBe(false);
    expect(result.revoked).toBe(true);
    expect(result.reason).toContain('revoked');
  });

  it('should detect untrusted issuer', () => {
    const untrustedIssuer = { ...mockIssuer, trusted: false };
    const result = validateProvenanceBadge(mockBadge, untrustedIssuer, currentTimestamp);

    expect(result.valid).toBe(false);
    expect(result.issuer_trusted).toBe(false);
    expect(result.reason).toContain('not trusted');
  });

  it('should calculate credibility score', () => {
    const score = getBadgeCredibilityScore(mockBadge, mockIssuer, currentTimestamp);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 0 score for invalid badge', () => {
    const expiredBadge = { ...mockBadge, expires_at: 2000 };
    const score = getBadgeCredibilityScore(expiredBadge, mockIssuer, currentTimestamp);

    expect(score).toBe(0);
  });

  it('should detect badge expiring soon', () => {
    const expiringBadge = { ...mockBadge, expires_at: currentTimestamp + 15 * 24 * 60 * 60 };
    expect(isBadgeExpiringSoon(expiringBadge, currentTimestamp)).toBe(true);
  });

  it('should detect badge not expiring soon', () => {
    const validBadge = { ...mockBadge, expires_at: currentTimestamp + 60 * 24 * 60 * 60 };
    expect(isBadgeExpiringSoon(validBadge, currentTimestamp)).toBe(false);
  });

  it('should get valid badges', () => {
    const badges = [mockBadge, { ...mockBadge, badge_id: 'badge-2', revoked: true }];
    const issuers = new Map([['GISSUER1', mockIssuer]]);

    const validBadges = getValidBadges(badges, issuers, currentTimestamp);

    expect(validBadges.length).toBe(1);
    expect(validBadges[0].badge_id).toBe('badge-1');
  });
});
