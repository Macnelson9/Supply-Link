/**
 * Trust Management Service (#495)
 * Handles actor trust weights and blacklist operations
 */

export interface ActorTrustWeight {
  actor: string;
  trust_weight: number; // 0-100
  blacklisted: boolean;
  blacklist_reason: string;
  last_updated: number;
}

export interface TrustScoreResult {
  actor: string;
  score: number;
  status: 'trusted' | 'neutral' | 'suspicious' | 'blacklisted';
  reason?: string;
}

/**
 * Calculate trust score based on weight and blacklist status
 */
export function calculateTrustScore(trust: ActorTrustWeight): TrustScoreResult {
  if (trust.blacklisted) {
    return {
      actor: trust.actor,
      score: 0,
      status: 'blacklisted',
      reason: trust.blacklist_reason,
    };
  }

  if (trust.trust_weight >= 75) {
    return {
      actor: trust.actor,
      score: trust.trust_weight,
      status: 'trusted',
    };
  }

  if (trust.trust_weight >= 50) {
    return {
      actor: trust.actor,
      score: trust.trust_weight,
      status: 'neutral',
    };
  }

  return {
    actor: trust.actor,
    score: trust.trust_weight,
    status: 'suspicious',
  };
}

/**
 * Format trust weight for display
 */
export function formatTrustWeight(weight: number): string {
  return `${weight}%`;
}

/**
 * Get trust badge color based on score
 */
export function getTrustBadgeColor(status: string): string {
  switch (status) {
    case 'trusted':
      return 'bg-green-100 text-green-800';
    case 'neutral':
      return 'bg-yellow-100 text-yellow-800';
    case 'suspicious':
      return 'bg-orange-100 text-orange-800';
    case 'blacklisted':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
