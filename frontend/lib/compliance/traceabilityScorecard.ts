/**
 * Traceability scorecard calculation and metrics.
 * Measures supply chain completeness and compliance coverage.
 */

export interface TraceabilityMetrics {
  eventCoverage: number; // 0-100: % of expected stages completed
  actorDiversity: number; // 0-100: % of unique actors involved
  timelineCompleteness: number; // 0-100: % of time gaps filled
  documentationQuality: number; // 0-100: % of events with metadata
  complianceAdherence: number; // 0-100: % of compliance rules met
}

export interface TraceabilityScorecard {
  productId: string;
  overallScore: number; // 0-100
  metrics: TraceabilityMetrics;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalEvents: number;
  uniqueActors: number;
  timeSpan: number; // seconds
  recommendations: string[];
  generatedAt: string;
}

const EXPECTED_STAGES = ['HARVEST', 'PROCESSING', 'SHIPPING', 'RETAIL'];
const MIN_TIME_BETWEEN_STAGES = 3600; // 1 hour minimum

export function calculateTraceabilityScore(
  productId: string,
  events: Array<{
    event_type: string;
    actor: string;
    timestamp: number;
    metadata: string;
  }>,
): TraceabilityScorecard {
  if (events.length === 0) {
    return {
      productId,
      overallScore: 0,
      metrics: {
        eventCoverage: 0,
        actorDiversity: 0,
        timelineCompleteness: 0,
        documentationQuality: 0,
        complianceAdherence: 0,
      },
      grade: 'F',
      totalEvents: 0,
      uniqueActors: 0,
      timeSpan: 0,
      recommendations: ['No events recorded yet. Start by registering the first tracking event.'],
      generatedAt: new Date().toISOString(),
    };
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Event Coverage: % of expected stages present
  const stagesPresent = new Set(sortedEvents.map((e) => e.event_type));
  const eventCoverage = (stagesPresent.size / EXPECTED_STAGES.length) * 100;

  // Actor Diversity: unique actors / total events
  const uniqueActors = new Set(sortedEvents.map((e) => e.actor)).size;
  const actorDiversity = Math.min(100, (uniqueActors / Math.max(1, sortedEvents.length)) * 100);

  // Timeline Completeness: check for reasonable gaps between events
  let timelineScore = 100;
  for (let i = 1; i < sortedEvents.length; i++) {
    const gap = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
    if (gap < MIN_TIME_BETWEEN_STAGES) {
      timelineScore -= 10; // Penalize suspiciously fast transitions
    }
  }
  const timelineCompleteness = Math.max(0, timelineScore);

  // Documentation Quality: % of events with non-empty metadata
  const eventsWithMetadata = sortedEvents.filter(
    (e) => e.metadata && e.metadata.trim().length > 0,
  ).length;
  const documentationQuality = (eventsWithMetadata / sortedEvents.length) * 100;

  // Compliance Adherence: check stage ordering
  let complianceScore = 100;
  const stageOrder: Record<string, number> = {
    HARVEST: 0,
    PROCESSING: 1,
    SHIPPING: 2,
    RETAIL: 3,
  };
  for (let i = 1; i < sortedEvents.length; i++) {
    const prevOrder = stageOrder[sortedEvents[i - 1].event_type] ?? -1;
    const currOrder = stageOrder[sortedEvents[i].event_type] ?? -1;
    if (currOrder !== -1 && prevOrder !== -1 && currOrder < prevOrder) {
      complianceScore -= 25; // Major violation: out-of-order stages
    }
  }
  const complianceAdherence = Math.max(0, complianceScore);

  const metrics: TraceabilityMetrics = {
    eventCoverage,
    actorDiversity,
    timelineCompleteness,
    documentationQuality,
    complianceAdherence,
  };

  const overallScore = Math.round(
    (eventCoverage +
      actorDiversity +
      timelineCompleteness +
      documentationQuality +
      complianceAdherence) /
      5,
  );

  const grade =
    overallScore >= 90
      ? 'A'
      : overallScore >= 80
        ? 'B'
        : overallScore >= 70
          ? 'C'
          : overallScore >= 60
            ? 'D'
            : 'F';

  const recommendations: string[] = [];
  if (eventCoverage < 75)
    recommendations.push('Add missing supply chain stages to improve coverage.');
  if (actorDiversity < 50)
    recommendations.push('Involve more actors in the supply chain for better traceability.');
  if (timelineCompleteness < 80)
    recommendations.push('Review event timestamps for anomalies or suspiciously fast transitions.');
  if (documentationQuality < 80)
    recommendations.push('Add detailed metadata to all tracking events.');
  if (complianceAdherence < 100)
    recommendations.push('Ensure events follow the correct supply chain order.');

  const timeSpan = sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp;

  return {
    productId,
    overallScore,
    metrics,
    grade,
    totalEvents: sortedEvents.length,
    uniqueActors,
    timeSpan,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
