/**
 * Async event validation tasks (#475).
 *
 * Each task receives a TrackingEvent and returns a ValidationCheck result.
 * Tasks are run by the validation job handler after event submission.
 */
import type { TrackingEvent, ValidationCheck, ValidationStatus } from '@/lib/types';

export type ValidationTask = (event: TrackingEvent) => Promise<ValidationCheck>;

// ── Regulatory checks ─────────────────────────────────────────────────────────

/** Verify the event has a non-empty actor address (basic regulatory requirement). */
export const checkActorPresent: ValidationTask = async (event) => ({
  name: 'actor_present',
  status: event.actor && event.actor.trim().length > 0 ? 'passed' : 'failed',
  message: event.actor ? undefined : 'Event actor address is missing',
});

/** Verify the event has a valid location string. */
export const checkLocationPresent: ValidationTask = async (event) => ({
  name: 'location_present',
  status: event.location && event.location.trim().length > 0 ? 'passed' : 'failed',
  message: event.location ? undefined : 'Event location is missing',
});

/** Verify metadata is valid JSON and non-empty. */
export const checkMetadataValid: ValidationTask = async (event) => {
  try {
    const parsed = JSON.parse(event.metadata);
    const hasKeys = Object.keys(parsed).length > 0;
    return {
      name: 'metadata_valid',
      status: hasKeys ? 'passed' : 'failed',
      message: hasKeys ? undefined : 'Event metadata is empty',
    };
  } catch {
    return {
      name: 'metadata_valid',
      status: 'failed',
      message: 'Event metadata is not valid JSON',
    };
  }
};

/** Certification compliance: HARVEST events should declare a certification_level. */
export const checkCertificationCompliance: ValidationTask = async (event) => {
  if (event.eventType !== 'HARVEST') {
    return { name: 'certification_compliance', status: 'skipped' };
  }
  try {
    const parsed = JSON.parse(event.metadata);
    const hasCert =
      typeof parsed.certification_level === 'string' && parsed.certification_level.length > 0;
    return {
      name: 'certification_compliance',
      status: hasCert ? 'passed' : 'failed',
      message: hasCert ? undefined : 'HARVEST events must include certification_level in metadata',
    };
  } catch {
    return { name: 'certification_compliance', status: 'failed', message: 'Cannot parse metadata' };
  }
};

/** Anomaly detection: flag events with a timestamp far in the future. */
export const checkTimestampAnomaly: ValidationTask = async (event) => {
  const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes
  const isFuture = event.timestamp > Date.now() + MAX_FUTURE_MS;
  return {
    name: 'timestamp_anomaly',
    status: isFuture ? 'failed' : 'passed',
    message: isFuture
      ? `Event timestamp is ${event.timestamp - Date.now()}ms in the future`
      : undefined,
  };
};

/** All tasks run for every event. */
export const ALL_VALIDATION_TASKS: ValidationTask[] = [
  checkActorPresent,
  checkLocationPresent,
  checkMetadataValid,
  checkCertificationCompliance,
  checkTimestampAnomaly,
];

/**
 * Run all validation tasks against an event and aggregate results.
 */
export async function runValidationTasks(
  event: TrackingEvent,
  tasks: ValidationTask[] = ALL_VALIDATION_TASKS,
): Promise<{ status: ValidationStatus; checks: ValidationCheck[] }> {
  const checks = await Promise.all(tasks.map((t) => t(event)));

  const hasFailed = checks.some((c) => c.status === 'failed');
  const allSkipped = checks.every((c) => c.status === 'skipped');

  const status: ValidationStatus = hasFailed ? 'failed' : allSkipped ? 'skipped' : 'passed';
  return { status, checks };
}
