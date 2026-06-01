'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import type { UsageAnalytics } from '@/lib/analytics/usageAnalytics';

interface AnalyticsDashboardProps {
  params: { locale: string };
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

export default function AnalyticsDashboard({ params }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState(24);

  async function fetchAnalytics() {
    try {
      const res = await fetch(`/api/analytics/usage?timeWindow=${timeWindow}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAnalytics(await res.json());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 30_000);
    return () => clearInterval(id);
  }, [timeWindow]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-[var(--muted)]">Loading analytics…</p>
      </main>
    );
  }

  if (error || !analytics) {
    return (
      <main className="p-6">
        <p className="text-red-500">Failed to load analytics: {error}</p>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">API Usage Analytics</h1>
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(parseInt(e.target.value))}
          className="px-3 py-2 border border-[var(--card-border)] rounded-lg bg-[var(--card)] text-[var(--foreground)]"
        >
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Requests',
            value: analytics.totalRequests,
            icon: Activity,
            trend: 'up',
          },
          {
            label: 'Total Errors',
            value: analytics.totalErrors,
            icon: AlertTriangle,
            trend: 'down',
          },
          {
            label: 'Error Rate',
            value: `${analytics.overallErrorRate.toFixed(2)}%`,
            icon: TrendingDown,
            trend: 'down',
          },
          {
            label: 'Endpoints Tracked',
            value: analytics.topEndpoints.length,
            icon: Activity,
            trend: 'up',
          },
        ].map(({ label, value, icon: Icon, trend }) => (
          <div
            key={label}
            className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl p-5 flex items-center gap-4 shadow-sm"
          >
            <div className="p-2 rounded-lg bg-[var(--muted-bg)]">
              <Icon size={20} className="text-[var(--foreground)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Request Timeline */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Request Volume Over Time
        </h2>
        <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl p-6 shadow-sm">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.requestsByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="hour" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top Endpoints */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Top Endpoints by Request Count
        </h2>
        <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--card-border)]">
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3 font-medium">Success Rate</th>
                <th className="px-4 py-3 font-medium">Avg Response Time</th>
                <th className="px-4 py-3 font-medium">p95 Response Time</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topEndpoints.map((ep) => (
                <tr
                  key={`${ep.method} ${ep.endpoint}`}
                  className="border-b border-[var(--card-border)] last:border-0 hover:bg-[var(--muted-bg)] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {ep.method} {ep.endpoint}
                  </td>
                  <td className="px-4 py-3">{ep.totalRequests}</td>
                  <td className="px-4 py-3">
                    <span className={ep.errorRate < 5 ? 'text-green-600' : 'text-red-600'}>
                      {(100 - ep.errorRate).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">{ep.avgResponseTime.toFixed(0)} ms</td>
                  <td className="px-4 py-3">{ep.p95ResponseTime.toFixed(0)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Error Distribution */}
      {Object.keys(analytics.errorsByType).length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Error Distribution
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl p-6 shadow-sm">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analytics.errorsByType).map(([status, count]) => ({
                      name: `${status}`,
                      value: count,
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(analytics.errorsByType).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {Object.entries(analytics.errorsByType).map(([status, count]) => (
                <div
                  key={status}
                  className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{status}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Slowest Endpoints */}
      {analytics.slowestEndpoints.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-yellow-600" />
            Slowest Endpoints
          </h2>
          <div className="space-y-2">
            {analytics.slowestEndpoints.map((ep) => (
              <div
                key={`${ep.method} ${ep.endpoint}`}
                className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm">
                    {ep.method} {ep.endpoint}
                  </span>
                  <span className="font-bold text-yellow-600">
                    {ep.avgResponseTime.toFixed(0)} ms
                  </span>
                </div>
                <div className="h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500"
                    style={{ width: `${Math.min(100, (ep.avgResponseTime / 1000) * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Most Error-Prone */}
      {analytics.mostErrorProne.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-600" />
            Most Error-Prone Endpoints
          </h2>
          <div className="space-y-2">
            {analytics.mostErrorProne.map((ep) => (
              <div
                key={`${ep.method} ${ep.endpoint}`}
                className="border border-red-200 bg-red-50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-red-900">
                    {ep.method} {ep.endpoint}
                  </span>
                  <span className="font-bold text-red-600">{ep.errorRate.toFixed(1)}% errors</span>
                </div>
                <p className="text-xs text-red-700">
                  {ep.errorCount} errors out of {ep.totalRequests} requests
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="text-xs text-[var(--muted)] text-center">
        Updated {new Date(analytics.collectedAt).toLocaleTimeString()} · Time window:{' '}
        {analytics.timeWindow}
      </div>
    </main>
  );
}
