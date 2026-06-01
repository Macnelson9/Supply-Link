'use client';

import {
  ActorTrustWeight,
  calculateTrustScore,
  getTrustBadgeColor,
} from '@/lib/services/trustManagement';

interface TrustWeightBadgeProps {
  trust: ActorTrustWeight;
  showLabel?: boolean;
}

export function TrustWeightBadge({ trust, showLabel = true }: TrustWeightBadgeProps) {
  const scoreResult = calculateTrustScore(trust);
  const badgeColor = getTrustBadgeColor(scoreResult.status);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${badgeColor}`}
    >
      <span className="font-bold">{trust.trust_weight}%</span>
      {showLabel && <span className="capitalize">{scoreResult.status}</span>}
      {trust.blacklisted && <span className="text-xs">⚠️ Blacklisted</span>}
    </div>
  );
}
