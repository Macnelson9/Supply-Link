/**
 * Lifecycle gap detector for missing events and chain breaks.
 * Detects when expected events are missing from a product's lifecycle.
 * Closes #483
 */

import type { TrackingEvent, EventType } from '@/lib/types';

export interface LifecycleGap {
  expectedEventType: EventType;
  missingAfterTimestamp: number;
  severity: 'warning' | 'critical';
  description: string;
}

export interface LifecycleAnalysis {
  hasGaps: boolean;
  gaps: LifecycleGap[];
  completionPercentage: number;
  lastEventTimestamp: number;
}

// Expected lifecycle sequence for products
const EXPECTED_LIFECYCLE: EventType[] = ['HARVEST', 'PROCESSING', 'SHIPPING', 'RETAIL'];

/**
 * Detect missing events in product lifecycle
 */
export function detectLifecycleGaps(events: TrackingEvent[]): LifecycleAnalysis {
  if (events.length === 0) {
    return {
      hasGaps: true,
      gaps: [
        {
          expectedEventType: 'HARVEST',
          missingAfterTimestamp: 0,
          severity: 'critical',
          description: 'No events recorded. Product lifecycle has not started.',
        },
      ],
      completionPercentage: 0,
      lastEventTimestamp: 0,
    };
  }

  const eventsByType = new Map<EventType, TrackingEvent[]>();
  let lastEventTimestamp = 0;

  // Group events by type and find latest timestamp
  for (const event of events) {
    const type = event.eventType;
    if (!eventsByType.has(type)) {
      eventsByType.set(type, []);
    }
    eventsByType.get(type)!.push(event);
    lastEventTimestamp = Math.max(lastEventTimestamp, event.timestamp);
  }

  const gaps: LifecycleGap[] = [];
  let previousEventTimestamp = 0;

  // Check for missing expected events in sequence
  for (const expectedType of EXPECTED_LIFECYCLE) {
    if (!eventsByType.has(expectedType)) {
      gaps.push({
        expectedEventType: expectedType,
        missingAfterTimestamp: previousEventTimestamp,
        severity: expectedType === 'HARVEST' ? 'critical' : 'warning',
        description: `Missing ${expectedType} event in product lifecycle.`,
      });
    } else {
      const typeEvents = eventsByType.get(expectedType)!;
      previousEventTimestamp = Math.max(...typeEvents.map((e) => e.timestamp));
    }
  }

  // Check for time gaps between consecutive events (>30 days)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const TIME_GAP_THRESHOLD = 30 * 24 * 60 * 60; // 30 days in seconds

  for (let i = 1; i < sortedEvents.length; i++) {
    const timeDiff = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
    if (timeDiff > TIME_GAP_THRESHOLD) {
      gaps.push({
        expectedEventType: sortedEvents[i].eventType,
        missingAfterTimestamp: sortedEvents[i - 1].timestamp,
        severity: 'warning',
        description: `Large time gap (${Math.floor(timeDiff / (24 * 60 * 60))} days) detected between events.`,
      });
    }
  }

  const completionPercentage = Math.round(
    ((EXPECTED_LIFECYCLE.length - gaps.filter((g) => g.severity === 'critical').length) /
      EXPECTED_LIFECYCLE.length) *
      100,
  );

  return {
    hasGaps: gaps.length > 0,
    gaps,
    completionPercentage,
    lastEventTimestamp,
  };
}

/**
 * Check if a product has critical gaps that need attention
 */
export function hasCriticalGaps(analysis: LifecycleAnalysis): boolean {
  return analysis.gaps.some((gap) => gap.severity === 'critical');
}

/**
 * Get human-readable gap summary
 */
export function getGapSummary(analysis: LifecycleAnalysis): string {
  if (!analysis.hasGaps) {
    return 'Product lifecycle is complete with no gaps detected.';
  }

  const criticalCount = analysis.gaps.filter((g) => g.severity === 'critical').length;
  const warningCount = analysis.gaps.filter((g) => g.severity === 'warning').length;

  let summary = '';
  if (criticalCount > 0) {
    summary += `${criticalCount} critical gap${criticalCount > 1 ? 's' : ''} found. `;
  }
  if (warningCount > 0) {
    summary += `${warningCount} warning${warningCount > 1 ? 's' : ''} detected.`;
  }

  return summary.trim();
}
