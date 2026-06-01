/**
 * API usage analytics collection and aggregation.
 * Tracks endpoint consumption, error rates, and performance metrics.
 */

export interface EndpointUsageMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  errorRate: number; // 0-100
  avgResponseTime: number; // milliseconds
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  lastUpdated: string;
}

export interface UsageAnalytics {
  collectedAt: string;
  timeWindow: string; // e.g., "24h", "7d"
  totalRequests: number;
  totalErrors: number;
  overallErrorRate: number;
  topEndpoints: EndpointUsageMetrics[];
  slowestEndpoints: EndpointUsageMetrics[];
  mostErrorProne: EndpointUsageMetrics[];
  requestsByHour: Array<{ hour: string; count: number }>;
  errorsByType: Record<string, number>;
}

// In-memory store for metrics (in production, use a database)
const metricsStore: Map<string, EndpointUsageMetrics> = new Map();
const requestTimestamps: number[] = [];
const errorLog: Array<{ timestamp: number; endpoint: string; status: number }> = [];

export function recordEndpointUsage(
  endpoint: string,
  method: string,
  status: number,
  responseTime: number,
): void {
  const key = `${method} ${endpoint}`;
  const now = Date.now();

  requestTimestamps.push(now);
  if (status >= 400) {
    errorLog.push({ timestamp: now, endpoint: key, status });
  }

  let metrics = metricsStore.get(key);
  if (!metrics) {
    metrics = {
      endpoint,
      method,
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  metrics.totalRequests += 1;
  if (status < 400) {
    metrics.successCount += 1;
  } else {
    metrics.errorCount += 1;
  }
  metrics.errorRate = (metrics.errorCount / metrics.totalRequests) * 100;
  metrics.avgResponseTime =
    (metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
  metrics.lastUpdated = new Date().toISOString();

  metricsStore.set(key, metrics);
}

export function getUsageAnalytics(timeWindowHours: number = 24): UsageAnalytics {
  const now = Date.now();
  const windowStart = now - timeWindowHours * 3600 * 1000;

  // Filter metrics within time window
  const recentRequests = requestTimestamps.filter((ts) => ts >= windowStart);
  const recentErrors = errorLog.filter((e) => e.timestamp >= windowStart);

  // Calculate hourly distribution
  const requestsByHour: Record<string, number> = {};
  for (let i = 0; i < timeWindowHours; i++) {
    const hourStart = now - (i + 1) * 3600 * 1000;
    const hourEnd = now - i * 3600 * 1000;
    const count = recentRequests.filter((ts) => ts >= hourStart && ts < hourEnd).length;
    const hour = new Date(hourEnd).toISOString().slice(0, 13);
    requestsByHour[hour] = count;
  }

  // Error distribution by status code
  const errorsByType: Record<string, number> = {};
  recentErrors.forEach((e) => {
    const key = `${e.status}`;
    errorsByType[key] = (errorsByType[key] ?? 0) + 1;
  });

  const topEndpoints = Array.from(metricsStore.values())
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 10);

  const slowestEndpoints = Array.from(metricsStore.values())
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
    .slice(0, 5);

  const mostErrorProne = Array.from(metricsStore.values())
    .filter((m) => m.errorCount > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  return {
    collectedAt: new Date().toISOString(),
    timeWindow: `${timeWindowHours}h`,
    totalRequests: recentRequests.length,
    totalErrors: recentErrors.length,
    overallErrorRate:
      recentRequests.length > 0 ? (recentErrors.length / recentRequests.length) * 100 : 0,
    topEndpoints,
    slowestEndpoints,
    mostErrorProne,
    requestsByHour: Object.entries(requestsByHour)
      .map(([hour, count]) => ({ hour, count }))
      .reverse(),
    errorsByType,
  };
}

export function clearMetrics(): void {
  metricsStore.clear();
  requestTimestamps.length = 0;
  errorLog.length = 0;
}
