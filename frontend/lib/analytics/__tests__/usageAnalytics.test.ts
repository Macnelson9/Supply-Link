import { describe, it, expect, beforeEach } from 'vitest';
import { recordEndpointUsage, getUsageAnalytics, clearMetrics } from '../usageAnalytics';

describe('usageAnalytics', () => {
  beforeEach(() => {
    clearMetrics();
  });

  it('records endpoint usage correctly', () => {
    recordEndpointUsage('/api/products', 'GET', 200, 50);
    recordEndpointUsage('/api/products', 'GET', 200, 60);
    recordEndpointUsage('/api/products', 'GET', 500, 100);

    const analytics = getUsageAnalytics(24);
    expect(analytics.totalRequests).toBe(3);
    expect(analytics.totalErrors).toBe(1);
  });

  it('calculates error rate correctly', () => {
    recordEndpointUsage('/api/test', 'GET', 200, 50);
    recordEndpointUsage('/api/test', 'GET', 200, 50);
    recordEndpointUsage('/api/test', 'GET', 500, 50);
    recordEndpointUsage('/api/test', 'GET', 500, 50);

    const analytics = getUsageAnalytics(24);
    expect(analytics.overallErrorRate).toBe(50);
  });

  it('tracks top endpoints by request count', () => {
    recordEndpointUsage('/api/products', 'GET', 200, 50);
    recordEndpointUsage('/api/products', 'GET', 200, 50);
    recordEndpointUsage('/api/products', 'GET', 200, 50);
    recordEndpointUsage('/api/events', 'POST', 201, 100);

    const analytics = getUsageAnalytics(24);
    expect(analytics.topEndpoints[0].endpoint).toBe('/api/products');
    expect(analytics.topEndpoints[0].totalRequests).toBe(3);
  });

  it('identifies slowest endpoints', () => {
    recordEndpointUsage('/api/fast', 'GET', 200, 10);
    recordEndpointUsage('/api/slow', 'GET', 200, 500);

    const analytics = getUsageAnalytics(24);
    expect(analytics.slowestEndpoints[0].endpoint).toBe('/api/slow');
    expect(analytics.slowestEndpoints[0].avgResponseTime).toBe(500);
  });

  it('identifies most error-prone endpoints', () => {
    recordEndpointUsage('/api/stable', 'GET', 200, 50);
    recordEndpointUsage('/api/stable', 'GET', 200, 50);
    recordEndpointUsage('/api/flaky', 'GET', 500, 50);
    recordEndpointUsage('/api/flaky', 'GET', 500, 50);

    const analytics = getUsageAnalytics(24);
    expect(analytics.mostErrorProne[0].endpoint).toBe('/api/flaky');
    expect(analytics.mostErrorProne[0].errorRate).toBe(100);
  });

  it('categorizes errors by status code', () => {
    recordEndpointUsage('/api/test', 'GET', 400, 50);
    recordEndpointUsage('/api/test', 'GET', 400, 50);
    recordEndpointUsage('/api/test', 'GET', 500, 50);

    const analytics = getUsageAnalytics(24);
    expect(analytics.errorsByType['400']).toBe(2);
    expect(analytics.errorsByType['500']).toBe(1);
  });

  it('respects time window filtering', () => {
    recordEndpointUsage('/api/test', 'GET', 200, 50);
    const analytics = getUsageAnalytics(24);
    expect(analytics.totalRequests).toBe(1);
  });

  it('calculates average response time', () => {
    recordEndpointUsage('/api/test', 'GET', 200, 100);
    recordEndpointUsage('/api/test', 'GET', 200, 200);
    recordEndpointUsage('/api/test', 'GET', 200, 300);

    const analytics = getUsageAnalytics(24);
    expect(analytics.topEndpoints[0].avgResponseTime).toBe(200);
  });

  it('clears metrics correctly', () => {
    recordEndpointUsage('/api/test', 'GET', 200, 50);
    clearMetrics();
    const analytics = getUsageAnalytics(24);
    expect(analytics.totalRequests).toBe(0);
  });
});
