import { useCallback } from 'react';
import {
  ProvenanceBadge,
  BadgeIssuer,
  validateProvenanceBadge,
  getBadgeCredibilityScore,
  getValidBadges,
  isBadgeExpiringSoon,
} from '@/lib/services/badgeIssuerRegistry';

export function useBadgeManagement() {
  const validateBadge = useCallback(
    (badge: ProvenanceBadge, issuer: BadgeIssuer, currentTimestamp: number) => {
      return validateProvenanceBadge(badge, issuer, currentTimestamp);
    },
    [],
  );

  const getCredibilityScore = useCallback(
    (badge: ProvenanceBadge, issuer: BadgeIssuer, currentTimestamp: number) => {
      return getBadgeCredibilityScore(badge, issuer, currentTimestamp);
    },
    [],
  );

  const getValid = useCallback(
    (badges: ProvenanceBadge[], issuers: Map<string, BadgeIssuer>, currentTimestamp: number) => {
      return getValidBadges(badges, issuers, currentTimestamp);
    },
    [],
  );

  const checkExpiringSoon = useCallback((badge: ProvenanceBadge, currentTimestamp: number) => {
    return isBadgeExpiringSoon(badge, currentTimestamp);
  }, []);

  return {
    validateBadge,
    getCredibilityScore,
    getValid,
    checkExpiringSoon,
  };
}
