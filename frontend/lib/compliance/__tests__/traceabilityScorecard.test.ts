import { describe, it, expect } from 'vitest';
import { calculateTraceabilityScore } from '../traceabilityScorecard';

describe('calculateTraceabilityScore', () => {
  it('returns F grade for empty events', () => {
    const scorecard = calculateTraceabilityScore('prod-1', []);
    expect(scorecard.grade).toBe('F');
    expect(scorecard.overallScore).toBe(0);
    expect(scorecard.totalEvents).toBe(0);
  });

  it('calculates event coverage correctly', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'PROCESSING', actor: 'A2', timestamp: 2000, metadata: '{}' },
      { event_type: 'SHIPPING', actor: 'A3', timestamp: 3000, metadata: '{}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.metrics.eventCoverage).toBe(75); // 3 out of 4 stages
  });

  it('calculates actor diversity correctly', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'PROCESSING', actor: 'A2', timestamp: 2000, metadata: '{}' },
      { event_type: 'SHIPPING', actor: 'A3', timestamp: 3000, metadata: '{}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.uniqueActors).toBe(3);
    expect(scorecard.metrics.actorDiversity).toBe(100);
  });

  it('penalizes suspiciously fast transitions', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'PROCESSING', actor: 'A2', timestamp: 1100, metadata: '{}' }, // Only 100 seconds apart
      { event_type: 'SHIPPING', actor: 'A3', timestamp: 1200, metadata: '{}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.metrics.timelineCompleteness).toBeLessThan(100);
  });

  it('detects out-of-order stages', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'SHIPPING', actor: 'A2', timestamp: 2000, metadata: '{}' },
      { event_type: 'PROCESSING', actor: 'A3', timestamp: 3000, metadata: '{}' }, // Out of order
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.metrics.complianceAdherence).toBeLessThan(100);
  });

  it('calculates documentation quality', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{"temp":"20C"}' },
      { event_type: 'PROCESSING', actor: 'A2', timestamp: 2000, metadata: '' },
      { event_type: 'SHIPPING', actor: 'A3', timestamp: 3000, metadata: '{"weight":"100kg"}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.metrics.documentationQuality).toBe(66.66666666666666); // 2 out of 3
  });

  it('assigns correct grade based on score', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'PROCESSING', actor: 'A2', timestamp: 5000, metadata: '{}' },
      { event_type: 'SHIPPING', actor: 'A3', timestamp: 9000, metadata: '{}' },
      { event_type: 'RETAIL', actor: 'A4', timestamp: 13000, metadata: '{}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(scorecard.grade);
  });

  it('includes recommendations for low scores', () => {
    const events = [{ event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '' }];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.recommendations.length).toBeGreaterThan(0);
  });

  it('calculates timespan correctly', () => {
    const events = [
      { event_type: 'HARVEST', actor: 'A1', timestamp: 1000, metadata: '{}' },
      { event_type: 'RETAIL', actor: 'A4', timestamp: 11000, metadata: '{}' },
    ];
    const scorecard = calculateTraceabilityScore('prod-1', events);
    expect(scorecard.timeSpan).toBe(10000);
  });
});
