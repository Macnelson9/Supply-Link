'use client';

import {
  ProvenanceBadge,
  BadgeIssuer,
  validateProvenanceBadge,
  formatBadgeType,
  getBadgeTypeColor,
  isBadgeExpiringSoon,
} from '@/lib/services/badgeIssuerRegistry';

interface ProvenanceBadgeDisplayProps {
  badge: ProvenanceBadge;
  issuer: BadgeIssuer;
  currentTimestamp?: number;
}

export function ProvenanceBadgeDisplay({
  badge,
  issuer,
  currentTimestamp = Date.now() / 1000,
}: ProvenanceBadgeDisplayProps) {
  const validation = validateProvenanceBadge(badge, issuer, currentTimestamp);
  const badgeColor = getBadgeTypeColor(badge.badge_type);
  const expiringSoon = isBadgeExpiringSoon(badge, currentTimestamp);

  return (
    <div className={`rounded-lg p-4 border-2 ${badgeColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-lg">{formatBadgeType(badge.badge_type)}</p>
          <p className="text-xs opacity-75">Issued by {issuer.issuer_name}</p>
        </div>
        <div className="flex gap-1">
          {!validation.valid && (
            <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">
              Invalid
            </span>
          )}
          {expiringSoon && (
            <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
              Expiring Soon
            </span>
          )}
          {badge.revoked && (
            <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">
              Revoked
            </span>
          )}
        </div>
      </div>

      <div className="text-xs opacity-75 space-y-1">
        <p>Issued: {new Date(badge.issued_at * 1000).toLocaleDateString()}</p>
        <p>Expires: {new Date(badge.expires_at * 1000).toLocaleDateString()}</p>
        {!validation.valid && (
          <p className="text-red-700 font-medium">Status: {validation.reason}</p>
        )}
      </div>
    </div>
  );
}

interface ProvenanceBadgesGridProps {
  badges: ProvenanceBadge[];
  issuers: Map<string, BadgeIssuer>;
  currentTimestamp?: number;
}

export function ProvenanceBadgesGrid({
  badges,
  issuers,
  currentTimestamp = Date.now() / 1000,
}: ProvenanceBadgesGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {badges.map((badge) => {
        const issuer = issuers.get(badge.issuer);
        if (!issuer) return null;

        return (
          <ProvenanceBadgeDisplay
            key={badge.badge_id}
            badge={badge}
            issuer={issuer}
            currentTimestamp={currentTimestamp}
          />
        );
      })}
    </div>
  );
}
