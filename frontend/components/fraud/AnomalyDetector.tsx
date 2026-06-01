'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { AnomalyDetectionResult } from '@/lib/fraud/speedAnomalyDetector';

interface AnomalyDetectorProps {
  productId: string;
}

export function AnomalyDetector({ productId }: AnomalyDetectorProps) {
  const [result, setResult] = useState<AnomalyDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnomalies() {
      try {
        const res = await fetch(`/api/v1/products/${productId}/anomalies`, {
          headers: { 'x-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? '' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setResult(await res.json());
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchAnomalies();
  }, [productId]);

  if (loading) {
    return <p className="text-[var(--muted)] text-sm">Analyzing events…</p>;
  }

  if (error || !result) {
    return <p className="text-red-500 text-sm">Failed to analyze anomalies: {error}</p>;
  }

  const riskColors = {
    low: 'bg-green-50 border-green-200 text-green-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  };

  const severityIcons = {
    low: <AlertCircle size={16} />,
    medium: <AlertTriangle size={16} />,
    high: <AlertTriangle size={16} />,
    critical: <AlertTriangle size={16} />,
  };

  return (
    <div className="space-y-4">
      {/* Risk Summary */}
      <div className={`border rounded-lg p-4 ${riskColors[result.riskLevel]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result.riskLevel === 'low' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <div>
              <p className="font-semibold">
                {result.riskLevel === 'low'
                  ? 'No anomalies detected'
                  : `${result.riskLevel.toUpperCase()} RISK`}
              </p>
              <p className="text-sm opacity-90">
                {result.anomaliesDetected} anomal{result.anomaliesDetected === 1 ? 'y' : 'ies'}{' '}
                found in {result.totalEvents} events
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly List */}
      {result.alerts.length > 0 && (
        <div className="space-y-2">
          {result.alerts.map((alert, idx) => {
            const severityColors = {
              low: 'bg-blue-50 border-blue-200 text-blue-800',
              medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
              high: 'bg-orange-50 border-orange-200 text-orange-800',
              critical: 'bg-red-50 border-red-200 text-red-800',
            };

            return (
              <div key={idx} className={`border rounded-lg p-3 ${severityColors[alert.severity]}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{severityIcons[alert.severity]}</div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.message}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="opacity-75">Actual time:</span>
                        <p className="font-mono font-semibold">
                          {(alert.timeBetweenEvents / 3600).toFixed(1)}h
                        </p>
                      </div>
                      <div>
                        <span className="opacity-75">Expected minimum:</span>
                        <p className="font-mono font-semibold">
                          {(alert.expectedMinimum / 3600).toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.anomaliesDetected === 0 && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle size={16} />
          All event transitions appear normal and within expected timeframes.
        </div>
      )}
    </div>
  );
}
