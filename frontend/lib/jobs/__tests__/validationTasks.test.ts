import { describe, it, expect } from 'vitest';
import {
  checkActorPresent,
  checkLocationPresent,
  checkMetadataValid,
  checkCertificationCompliance,
  checkTimestampAnomaly,
  runValidationTasks,
} from '../validationTasks';
import type { TrackingEvent } from '@/lib/types';

const baseEvent: TrackingEvent = {
  productId: 'prod-001',
  eventType: 'SHIPPING',
  location: 'Rotterdam, Netherlands',
  actor: 'GACTOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567',
  timestamp: Date.now() - 1000,
  metadata: JSON.stringify({ vessel: 'MV Test', carbon_footprint: 10 }),
};

describe('checkActorPresent', () => {
  it('passes when actor is set', async () => {
    const result = await checkActorPresent(baseEvent);
    expect(result.status).toBe('passed');
  });

  it('fails when actor is empty', async () => {
    const result = await checkActorPresent({ ...baseEvent, actor: '' });
    expect(result.status).toBe('failed');
  });
});

describe('checkLocationPresent', () => {
  it('passes when location is set', async () => {
    const result = await checkLocationPresent(baseEvent);
    expect(result.status).toBe('passed');
  });

  it('fails when location is empty', async () => {
    const result = await checkLocationPresent({ ...baseEvent, location: '' });
    expect(result.status).toBe('failed');
  });
});

describe('checkMetadataValid', () => {
  it('passes for valid non-empty JSON', async () => {
    const result = await checkMetadataValid(baseEvent);
    expect(result.status).toBe('passed');
  });

  it('fails for empty JSON object', async () => {
    const result = await checkMetadataValid({ ...baseEvent, metadata: '{}' });
    expect(result.status).toBe('failed');
  });

  it('fails for invalid JSON', async () => {
    const result = await checkMetadataValid({ ...baseEvent, metadata: 'not-json' });
    expect(result.status).toBe('failed');
  });
});

describe('checkCertificationCompliance', () => {
  it('skips for non-HARVEST events', async () => {
    const result = await checkCertificationCompliance(baseEvent);
    expect(result.status).toBe('skipped');
  });

  it('passes for HARVEST with certification_level', async () => {
    const event: TrackingEvent = {
      ...baseEvent,
      eventType: 'HARVEST',
      metadata: JSON.stringify({ certification_level: 'gold' }),
    };
    const result = await checkCertificationCompliance(event);
    expect(result.status).toBe('passed');
  });

  it('fails for HARVEST without certification_level', async () => {
    const event: TrackingEvent = {
      ...baseEvent,
      eventType: 'HARVEST',
      metadata: JSON.stringify({ notes: 'no cert' }),
    };
    const result = await checkCertificationCompliance(event);
    expect(result.status).toBe('failed');
  });
});

describe('checkTimestampAnomaly', () => {
  it('passes for a recent timestamp', async () => {
    const result = await checkTimestampAnomaly(baseEvent);
    expect(result.status).toBe('passed');
  });

  it('fails for a timestamp far in the future', async () => {
    const futureEvent: TrackingEvent = {
      ...baseEvent,
      timestamp: Date.now() + 10 * 60 * 1000, // 10 minutes ahead
    };
    const result = await checkTimestampAnomaly(futureEvent);
    expect(result.status).toBe('failed');
  });
});

describe('runValidationTasks', () => {
  it('returns passed when all tasks pass', async () => {
    const { status, checks } = await runValidationTasks(baseEvent);
    expect(status).toBe('passed');
    expect(checks.length).toBeGreaterThan(0);
  });

  it('returns failed when any task fails', async () => {
    const { status } = await runValidationTasks({ ...baseEvent, actor: '' });
    expect(status).toBe('failed');
  });

  it('returns skipped when all tasks skip', async () => {
    const { status } = await runValidationTasks(baseEvent, [
      async () => ({ name: 'noop', status: 'skipped' }),
    ]);
    expect(status).toBe('skipped');
  });
});
