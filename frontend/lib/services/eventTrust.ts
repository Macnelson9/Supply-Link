import type { TrackingEvent } from '@/lib/types';
import { calculateTrustScore, type ActorTrustWeight } from '@/lib/services/trustManagement';

export interface ActorReputation extends ActorTrustWeight {
  eventsSigned: number;
  approvalCompliance: number;
  timelinessScore: number;
  recallInvolvement: number;
  invalidMetadataCount: number;
}

export interface EventTrustScore {
  eventKey: string;
  actor: string;
  actorTrustWeight: number;
  eventTrustWeight: number;
  status: 'trusted' | 'neutral' | 'suspicious' | 'blacklisted';
  reason?: string;
}

const DEFAULT_TRUST_WEIGHT = 50;
const MAX_ACTOR_EVENT_BONUS = 30;
const MAX_APPROVAL_BONUS = 10;
const MAX_TIMELINESS_BONUS = 15;
const INVALID_METADATA_PENALTY = 5;
const RECALL_INVOLVEMENT_PENALTY = 40;
const TIMELINESS_WINDOW_SECONDS = 7 * 24 * 60 * 60; // 7 days

function parseEventMetadata(event: TrackingEvent): Record<string, unknown> {
  try {
    return JSON.parse(event.metadata || '{}');
  } catch {
    return {};
  }
}

function hasRecallFlag(metadata: Record<string, unknown>): boolean {
  return metadata.recall === true || metadata.quality_issue === true || metadata.blacklist === true;
}

function hasApprovalFlag(metadata: Record<string, unknown>): boolean {
  return metadata.approved === true;
}

function metadataIsComplete(metadata: Record<string, unknown>): boolean {
  return Object.keys(metadata).length > 0;
}

export function calculateActorReputations(events: TrackingEvent[]): ActorReputation[] {
  const actorMap = new Map<string, TrackingEvent[]>();
  for (const event of events) {
    actorMap.set(event.actor, [...(actorMap.get(event.actor) ?? []), event]);
  }

  const reputations: ActorReputation[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const [actor, actorEvents] of actorMap.entries()) {
    const sortedEvents = [...actorEvents].sort((a, b) => a.timestamp - b.timestamp);
    let approvedCount = 0;
    let recallCount = 0;
    let invalidMetadataCount = 0;
    let timelyGaps = 0;

    for (let i = 0; i < sortedEvents.length; i += 1) {
      const metadata = parseEventMetadata(sortedEvents[i]);
      if (hasApprovalFlag(metadata)) approvedCount += 1;
      if (hasRecallFlag(metadata)) recallCount += 1;
      if (!metadataIsComplete(metadata)) invalidMetadataCount += 1;

      if (i > 0) {
        const gap = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
        if (gap > 0 && gap <= TIMELINESS_WINDOW_SECONDS) {
          timelyGaps += 1;
        }
      }
    }

    const eventCount = sortedEvents.length;
    const eventBonus = Math.min(eventCount * 3, MAX_ACTOR_EVENT_BONUS);
    const approvalBonus = eventCount > 0 ? Math.min(Math.floor((approvedCount / eventCount) * MAX_APPROVAL_BONUS), MAX_APPROVAL_BONUS) : 0;
    const timelinessBonus = Math.min(timelyGaps * 3, MAX_TIMELINESS_BONUS);

    let trustWeight = DEFAULT_TRUST_WEIGHT + eventBonus + approvalBonus + timelinessBonus;
    trustWeight -= invalidMetadataCount * INVALID_METADATA_PENALTY;
    trustWeight = Math.min(100, Math.max(0, trustWeight));

    const blacklisted = recallCount > 0;
    const blacklistReason = blacklisted ? 'Recall involvement or quality issue' : '';
    if (blacklisted) trustWeight = 0;

    reputations.push({
      actor,
      trust_weight: trustWeight,
      blacklisted,
      blacklist_reason: blacklistReason,
      last_updated: now,
      eventsSigned: eventCount,
      approvalCompliance: eventCount > 0 ? Math.round((approvedCount / eventCount) * 100) : 0,
      timelinessScore: eventCount > 1 ? Math.min(100, Math.round((timelyGaps / (eventCount - 1)) * 100)) : 0,
      recallInvolvement: recallCount,
      invalidMetadataCount,
    });
  }

  return reputations.sort((a, b) => b.trust_weight - a.trust_weight);
}

export function calculateEventTrust(
  event: TrackingEvent,
  actorReputation?: ActorReputation,
): EventTrustScore {
  const metadata = parseEventMetadata(event);
  const actorTrustWeight = actorReputation?.trust_weight ?? DEFAULT_TRUST_WEIGHT;
  const metadataScore = metadataIsComplete(metadata) ? 100 : 50;
  const consistencyScore = actorReputation?.timelinessScore ?? 50;

  const eventTrustWeight = Math.round(
    actorTrustWeight * 0.7 + metadataScore * 0.2 + consistencyScore * 0.1,
  );

  const status = actorReputation?.blacklisted
    ? 'blacklisted'
    : eventTrustWeight >= 75
      ? 'trusted'
      : eventTrustWeight >= 50
        ? 'neutral'
        : 'suspicious';

  const reason = actorReputation?.blacklisted
    ? actorReputation.blacklist_reason
    : metadataIsComplete(metadata)
      ? undefined
      : 'Event metadata is incomplete';

  return {
    eventKey: event.stableId ?? `${event.actor}-${event.timestamp}`,
    actor: event.actor,
    actorTrustWeight,
    eventTrustWeight,
    status,
    reason,
  };
}

export function averageActorTrustWeight(reputations: ActorReputation[]): number {
  if (reputations.length === 0) return DEFAULT_TRUST_WEIGHT;
  const total = reputations.reduce((sum, rep) => sum + rep.trust_weight, 0);
  return Math.round(total / reputations.length);
}

export function getEventTrustBadgeClass(status: EventTrustScore['status']): string {
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

export function getEventTrustSummary(actorReputation: ActorReputation): string {
  const score = calculateTrustScore(actorReputation);
  return `${score.status} (${actorReputation.trust_weight}%)`;
}
