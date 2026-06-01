'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Download, TrendingUp } from 'lucide-react';
import type { TraceabilityScorecard } from '@/lib/compliance/traceabilityScorecard';

interface ScorecardPageProps {
  params: { id: string };
}

export default function ScorecardPage({ params }: ScorecardPageProps) {
  const [scorecard, setScorecard] = useState<TraceabilityScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScorecard() {
      try {
        const res = await fetch(`/api/v1/products/${params.id}/scorecard`, {
          headers: { 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setScorecard(await res.json());
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchScorecard();
  }, [params.id]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-[var(--muted)]">Loading scorecard…</p>
      </main>
    );
  }

  if (error || !scorecard) {
    return (
      <main className="p-6">
        <p className="text-red-500">Failed to load scorecard: {error}</p>
      </main>
    );
  }

  const gradeColor = {
    A: 'text-green-600 bg-green-50',
    B: 'text-blue-600 bg-blue-50',
    C: 'text-yellow-600 bg-yellow-50',
    D: 'text-orange-600 bg-orange-50',
    F: 'text-red-600 bg-red-50',
  };

  const handleExport = () => {
    const csv = [
      ['Traceability Scorecard Report'],
      ['Product ID', scorecard.productId],
      ['Overall Score', scorecard.overallScore],
      ['Grade', scorecard.grade],
      ['Generated At', scorecard.generatedAt],
      [],
      ['Metric', 'Score'],
      ['Event Coverage', scorecard.metrics.eventCoverage.toFixed(2)],
      ['Actor Diversity', scorecard.metrics.actorDiversity.toFixed(2)],
      ['Timeline Completeness', scorecard.metrics.timelineCompleteness.toFixed(2)],
      ['Documentation Quality', scorecard.metrics.documentationQuality.toFixed(2)],
      ['Compliance Adherence', scorecard.metrics.complianceAdherence.toFixed(2)],
      [],
      ['Total Events', scorecard.totalEvents],
      ['Unique Actors', scorecard.uniqueActors],
      ['Time Span (seconds)', scorecard.timeSpan],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scorecard-${scorecard.productId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="p-4 md:p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Traceability Scorecard</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Overall Score Card */}
      <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--muted)] mb-2">Overall Traceability Score</p>
            <p className="text-5xl font-bold text-[var(--foreground)]">{scorecard.overallScore}</p>
            <p className="text-xs text-[var(--muted)] mt-2">out of 100</p>
          </div>
          <div className={`text-6xl font-bold rounded-lg p-6 ${gradeColor[scorecard.grade]}`}>
            {scorecard.grade}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Compliance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Event Coverage', value: scorecard.metrics.eventCoverage, icon: TrendingUp },
            {
              label: 'Actor Diversity',
              value: scorecard.metrics.actorDiversity,
              icon: CheckCircle,
            },
            {
              label: 'Timeline Completeness',
              value: scorecard.metrics.timelineCompleteness,
              icon: TrendingUp,
            },
            {
              label: 'Documentation Quality',
              value: scorecard.metrics.documentationQuality,
              icon: CheckCircle,
            },
            {
              label: 'Compliance Adherence',
              value: scorecard.metrics.complianceAdherence,
              icon: CheckCircle,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
                <Icon size={16} className="text-[var(--muted)]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--foreground)]">
                  {value.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--muted)]">%</span>
              </div>
              <div className="mt-2 h-2 bg-[var(--muted-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Summary Stats */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Events', value: scorecard.totalEvents },
            { label: 'Unique Actors', value: scorecard.uniqueActors },
            { label: 'Time Span (hours)', value: (scorecard.timeSpan / 3600).toFixed(1) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="border border-[var(--card-border)] bg-[var(--card)] rounded-lg p-4 shadow-sm"
            >
              <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      {scorecard.recommendations.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-yellow-600" />
            Recommendations
          </h2>
          <div className="space-y-2">
            {scorecard.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800"
              >
                {rec}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Metadata */}
      <div className="text-xs text-[var(--muted)] text-center">
        Generated at {new Date(scorecard.generatedAt).toLocaleString()}
      </div>
    </main>
  );
}
