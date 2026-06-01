/**
 * Speed anomaly detection for supply chain events.
 * Identifies suspiciously fast event transitions that may indicate fraud.
 */

export interface AnomalyAlert {
  eventIndex: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timeBetweenEvents: number; // seconds
  expectedMinimum: number; // seconds
  fromStage: string;
  toStage: string;
}

export interface AnomalyDetectionResult {
  productId: string;
  totalEvents: number;
  anomaliesDetected: number;
  alerts: AnomalyAlert[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  analysisTimestamp: string;
}

// Minimum realistic time between stages (in seconds)
const STAGE_MINIMUMS: Record<string, Record<string, number>> = {
  HARVEST: {
    PROCESSING: 3600, // 1 hour minimum
    SHIPPING: 86400, // 1 day minimum
    RETAIL: 172800, // 2 days minimum
  },
  PROCESSING: {
    SHIPPING: 3600, // 1 hour minimum
    RETAIL: 86400, // 1 day minimum
  },
  SHIPPING: {
    RETAIL: 3600, // 1 hour minimum
  },
};

function getSeverity(
  timeBetween: number,
  expected: number,
): 'low' | 'medium' | 'high' | 'critical' {
  const ratio = timeBetween / expected;
  if (ratio < 0.1) return 'critical'; // Less than 10% of expected time
  if (ratio < 0.25) return 'high'; // Less than 25% of expected time
  if (ratio < 0.5) return 'medium'; // Less than 50% of expected time
  return 'low'; // Less than expected but reasonable
}

export function detectSpeedAnomalies(
  productId: string,
  events: Array<{
    event_type: string;
    timestamp: number;
  }>,
): AnomalyDetectionResult {
  const alerts: AnomalyAlert[] = [];

  if (events.length < 2) {
    return {
      productId,
      totalEvents: events.length,
      anomaliesDetected: 0,
      alerts: [],
      riskLevel: 'low',
      analysisTimestamp: new Date().toISOString(),
    };
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 1; i < sortedEvents.length; i++) {
    const prevEvent = sortedEvents[i - 1];
    const currEvent = sortedEvents[i];
    const timeBetween = currEvent.timestamp - prevEvent.timestamp;

    const expectedMin = STAGE_MINIMUMS[prevEvent.event_type]?.[currEvent.event_type];

    if (expectedMin && timeBetween < expectedMin) {
      const severity = getSeverity(timeBetween, expectedMin);
      alerts.push({
        eventIndex: i,
        severity,
        message: `Suspiciously fast transition from ${prevEvent.event_type} to ${currEvent.event_type}`,
        timeBetweenEvents: timeBetween,
        expectedMinimum: expectedMin,
        fromStage: prevEvent.event_type,
        toStage: currEvent.event_type,
      });
    }
  }

  // Determine overall risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (alerts.some((a) => a.severity === 'critical')) riskLevel = 'critical';
  else if (alerts.some((a) => a.severity === 'high')) riskLevel = 'high';
  else if (alerts.some((a) => a.severity === 'medium')) riskLevel = 'medium';

  return {
    productId,
    totalEvents: sortedEvents.length,
    anomaliesDetected: alerts.length,
    alerts,
    riskLevel,
    analysisTimestamp: new Date().toISOString(),
  };
}
