/**
 * Provenance Badge Issuer Registry Service (#498)
 * Manages trusted badge issuers and provenance badge validation
 */

export interface BadgeIssuer {
  issuer: string;
  issuer_name: string;
  badge_type: string;
  trusted: boolean;
  registered_at: number;
}

export interface ProvenanceBadge {
  badge_id: string;
  product_id: string;
  issuer: string;
  badge_type: string;
  issued_at: number;
  expires_at: number;
  revoked: boolean;
}

export interface BadgeValidationResult {
  badge_id: string;
  valid: boolean;
  reason: string;
  issuer_trusted: boolean;
  expired: boolean;
  revoked: boolean;
}

// Standard badge types
export const STANDARD_BADGE_TYPES = [
  'ORGANIC',
  'FAIR_TRADE',
  'ISO_9001',
  'ISO_14001',
  'RAINFOREST_ALLIANCE',
  'CERTIFIED_SUSTAINABLE',
  'CARBON_NEUTRAL',
  'ETHICAL_SOURCING',
];

/**
 * Validate a provenance badge
 */
export function validateProvenanceBadge(
  badge: ProvenanceBadge,
  issuer: BadgeIssuer,
  currentTimestamp: number,
): BadgeValidationResult {
  const expired = badge.expires_at < currentTimestamp;
  const issuerTrusted = issuer.trusted;
  const revoked = badge.revoked;

  let valid = issuerTrusted && !expired && !revoked;
  let reason = '';

  if (revoked) {
    reason = 'Badge has been revoked';
    valid = false;
  } else if (expired) {
    reason = 'Badge has expired';
    valid = false;
  } else if (!issuerTrusted) {
    reason = 'Issuer is not trusted';
    valid = false;
  } else {
    reason = 'Badge is valid';
  }

  return {
    badge_id: badge.badge_id,
    valid,
    reason,
    issuer_trusted: issuerTrusted,
    expired,
    revoked,
  };
}

/**
 * Get badge credibility score (0-100)
 */
export function getBadgeCredibilityScore(
  badge: ProvenanceBadge,
  issuer: BadgeIssuer,
  currentTimestamp: number,
): number {
  const validation = validateProvenanceBadge(badge, issuer, currentTimestamp);

  if (!validation.valid) {
    return 0;
  }

  let score = 100;

  // Reduce score based on time since issuance
  const ageInDays = (currentTimestamp - badge.issued_at) / (24 * 60 * 60);
  if (ageInDays > 365) {
    score -= Math.min(30, Math.floor(ageInDays / 365) * 10);
  }

  // Reduce score based on time until expiration
  const daysUntilExpiry = (badge.expires_at - currentTimestamp) / (24 * 60 * 60);
  if (daysUntilExpiry < 30) {
    score -= Math.min(20, Math.floor((30 - daysUntilExpiry) / 3));
  }

  return Math.max(0, score);
}

/**
 * Format badge type for display
 */
export function formatBadgeType(badgeType: string): string {
  return badgeType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get badge color based on type
 */
export function getBadgeTypeColor(badgeType: string): string {
  const colors: Record<string, string> = {
    ORGANIC: 'bg-green-100 text-green-800',
    FAIR_TRADE: 'bg-blue-100 text-blue-800',
    ISO_9001: 'bg-purple-100 text-purple-800',
    ISO_14001: 'bg-emerald-100 text-emerald-800',
    RAINFOREST_ALLIANCE: 'bg-teal-100 text-teal-800',
    CERTIFIED_SUSTAINABLE: 'bg-lime-100 text-lime-800',
    CARBON_NEUTRAL: 'bg-sky-100 text-sky-800',
    ETHICAL_SOURCING: 'bg-indigo-100 text-indigo-800',
  };

  return colors[badgeType] || 'bg-gray-100 text-gray-800';
}

/**
 * Check if badge is expiring soon (within 30 days)
 */
export function isBadgeExpiringSoon(badge: ProvenanceBadge, currentTimestamp: number): boolean {
  const daysUntilExpiry = (badge.expires_at - currentTimestamp) / (24 * 60 * 60);
  return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
}

/**
 * Get all valid badges for a product
 */
export function getValidBadges(
  badges: ProvenanceBadge[],
  issuers: Map<string, BadgeIssuer>,
  currentTimestamp: number,
): ProvenanceBadge[] {
  return badges.filter((badge) => {
    const issuer = issuers.get(badge.issuer);
    if (!issuer) return false;

    const validation = validateProvenanceBadge(badge, issuer, currentTimestamp);
    return validation.valid;
  });
}
