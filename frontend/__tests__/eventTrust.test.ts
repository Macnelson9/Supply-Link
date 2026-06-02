import { describe, it, expect } from 'vitest';
import type { TrackingEvent } from '@/lib/types';
import {
  calculateActorReputations,
  calculateEventTrust,
  averageActorTrustWeight,
} from '@/lib/services/eventTrust';
import { calculateProvenanceScore } from '@/lib/utils/provenanceScore';

function makeEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    productId: 'prod-001',
    location: 'Warehouse A',
    actor: 'GACTOR123',
    timestamp: 1710000000,
    eventType: 'PROCESSING',
    metadata: JSON.stringify({ approved: true, batch: 'B1' }),
    stableId: 'evt-001',
    ...overrides,
  };
}

describe('Event Trust', () => {
  it('calculates actor reputation from historical events', () => {
    const events: TrackingEvent[] = [
      makeEvent({ actor: 'GACTOR123', timestamp: 1710000000 }),
      makeEvent({ actor: 'GACTOR123', timestamp: 1710003600 }),
      makeEvent({ actor: 'GACTOR123', timestamp: 1710007200 }),
    ];

    const reputations = calculateActorReputations(events);
    expect(reputations).toHaveLength(1);
    expect(reputations[0].actor).toBe('GACTOR123');
    expect(reputations[0].trust_weight).toBeGreaterThan(50);
    expect(reputations[0].approvalCompliance).toBe(100);
    expect(reputations[0].timelinessScore).toBeGreaterThan(0);
  });

  it('flags an actor as blacklisted when recall or quality issue metadata exists', () => {
    const events: TrackingEvent[] = [
      makeEvent({ actor: 'GACTOR999', metadata: JSON.stringify({ recall: true }) }),
    ];

    const reputations = calculateActorReputations(events);
    expect(reputations[0].blacklisted).toBe(true);
    expect(reputations[0].trust_weight).toBe(0);
  });

  it('computes event trust from actor reputation and metadata completeness', () => {
    const events: TrackingEvent[] = [
      makeEvent({ actor: 'GACTOR123', timestamp: 1710000000 }),
      makeEvent({ actor: 'GACTOR123', timestamp: 1710003600 }),
    ];

    const reputations = calculateActorReputations(events);
    const eventTrust = calculateEventTrust(events[1], reputations[0]);

    expect(eventTrust.actorTrustWeight).toBe(reputations[0].trust_weight);
    expect(eventTrust.eventTrustWeight).toBeGreaterThanOrEqual(50);
    expect(eventTrust.status).toMatch(/trusted|neutral|suspicious/);
  });

  it('includes average actor reputation in provenance scoring', () => {
    const events: TrackingEvent[] = [
      makeEvent({ actor: 'GACTOR123', timestamp: 1710000000 }),
      makeEvent({ actor: 'GACTOR456', timestamp: 1710003600, metadata: JSON.stringify({ approved: false }) }),
    ];

    const reputations = calculateActorReputations(events);
    const averageTrust = averageActorTrustWeight(reputations);
    const scoreWithTrust = calculateProvenanceScore(events, undefined, averageTrust);
    const scoreWithoutTrust = calculateProvenanceScore(events, undefined, 50);

    expect(scoreWithTrust.actorReputation).toBeGreaterThanOrEqual(0);
    expect(scoreWithTrust.total).toBeGreaterThanOrEqual(scoreWithoutTrust.total);
  });
});
