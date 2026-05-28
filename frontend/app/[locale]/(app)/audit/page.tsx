'use client';

import { redirect } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Package, Activity, Clock, Search } from 'lucide-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useStore } from '@/lib/state/store';
import { EventTimeline } from '@/components/tracking/EventTimeline';
import { useState } from 'react';
import type { TrackingEvent } from '@/lib/types';
import { EVENT_TYPE_CONFIG } from '@/lib/eventTypeConfig';
import type { EventType } from '@/lib/types';

export default function AuditPage() {
  const params = useSearchParams();
  // Enforce audit mode — redirect away if not in audit mode
  if (params.get('audit') !== '1') {
    redirect('/audit?audit=1');
  }

  const { stats, recentEvents } = useDashboardData({
    from: Date.now() - 90 * 86_400_000,
    to: Date.now(),
  });
  const products = useStore((s) => s.products);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const events = useStore((s) => s.events);

  const filteredProducts = products.filter(
    (p) =>
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()),
  );

  const productEvents: TrackingEvent[] = selectedProductId
    ? events.filter((e) => e.productId === selectedProductId)
    : [];

  return (
    <main className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck size={24} className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">Read-only provenance and event history view</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: stats.totalProducts, icon: Package },
          { label: 'Total Events (90d)', value: stats.totalEvents, icon: Activity },
          { label: 'Active Products', value: stats.activeProducts, icon: ShieldCheck },
          { label: 'Last 24 h', value: stats.recentActivity, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
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

      {/* Product provenance search */}
      <section className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center gap-3">
          <Search size={16} className="text-[var(--muted)]" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Product Provenance Search
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <input
            type="text"
            placeholder="Search by product name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {filteredProducts.length > 0 && (
            <ul className="divide-y divide-[var(--card-border)]">
              {filteredProducts.slice(0, 20).map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedProductId(p.id === selectedProductId ? null : p.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-[var(--muted-bg)] transition-colors rounded-lg flex items-center justify-between ${
                      selectedProductId === p.id ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">{p.name}</p>
                      <p className="text-xs text-[var(--muted)] font-mono">{p.id}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedProductId && (
            <div className="mt-4 border-t border-[var(--card-border)] pt-4">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
                Event History — {selectedProductId}
              </p>
              {productEvents.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No events recorded.</p>
              ) : (
                <EventTimeline events={productEvents} />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Recent events across all products */}
      <section className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--card-border)]">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Recent Contract Events (90 days)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--card-border)]">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Location</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Actor</th>
                <th className="px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-[var(--muted)]">
                    No events found.
                  </td>
                </tr>
              ) : (
                recentEvents.map((e, i) => {
                  const cfg = EVENT_TYPE_CONFIG[e.eventType as EventType];
                  const Icon = cfg?.icon;
                  return (
                    <tr
                      key={i}
                      className="border-b border-[var(--card-border)] last:border-0 hover:bg-[var(--muted-bg)] transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-[var(--foreground)]">
                        {e.productId}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.badgeClass ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {Icon && <Icon size={11} />}
                          {cfg?.label ?? e.eventType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--foreground)] hidden sm:table-cell">
                        {e.location}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--muted)] hidden md:table-cell">
                        {e.actor.slice(0, 8)}…{e.actor.slice(-6)}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted)]">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
