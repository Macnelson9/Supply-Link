import { describe, it, expect } from 'vitest';
import { detectSpeedAnomalies } from '../speedAnomalyDetector';

describe('detectSpeedAnomalies', () => {
  it('returns no anomalies for empty events', () => {
    const result = detectSpeedAnomalies('prod-1', []);
    expect(result.anomaliesDetected).toBe(0);
    expect(result.riskLevel).toBe('low');
  });

  it('returns no anomalies for single event', () => {
    const events = [{ event_type: 'HARVEST', timestamp: 1000 }];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(0);
    expect(result.riskLevel).toBe('low');
  });

  it('detects critical anomaly for extremely fast transition', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 1100 }, // Only 100 seconds (should be 3600+)
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(1);
    expect(result.alerts[0].severity).toBe('critical');
    expect(result.riskLevel).toBe('critical');
  });

  it('detects high severity for moderately fast transition', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 1800 }, // 800 seconds (should be 3600+)
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(1);
    expect(result.alerts[0].severity).toBe('high');
  });

  it('detects medium severity for slightly fast transition', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 2800 }, // 1800 seconds (should be 3600+)
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(1);
    expect(result.alerts[0].severity).toBe('medium');
  });

  it('allows normal transitions', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 5000 }, // 4000 seconds (> 3600)
      { event_type: 'SHIPPING', timestamp: 10000 }, // 5000 seconds (> 3600)
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(0);
    expect(result.riskLevel).toBe('low');
  });

  it('detects multiple anomalies', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 1100 }, // Anomaly
      { event_type: 'SHIPPING', timestamp: 1200 }, // Anomaly
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(2);
  });

  it('sets overall risk to critical if any critical alert exists', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 1100 }, // Critical
      { event_type: 'SHIPPING', timestamp: 5000 }, // Normal
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.riskLevel).toBe('critical');
  });

  it('includes alert details', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'PROCESSING', timestamp: 1100 },
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    const alert = result.alerts[0];
    expect(alert.eventIndex).toBe(1);
    expect(alert.fromStage).toBe('HARVEST');
    expect(alert.toStage).toBe('PROCESSING');
    expect(alert.timeBetweenEvents).toBe(100);
    expect(alert.expectedMinimum).toBe(3600);
  });

  it('handles unknown stage transitions gracefully', () => {
    const events = [
      { event_type: 'HARVEST', timestamp: 1000 },
      { event_type: 'UNKNOWN_STAGE', timestamp: 1100 },
    ];
    const result = detectSpeedAnomalies('prod-1', events);
    expect(result.anomaliesDetected).toBe(0); // No rule for unknown stage
  });
});
