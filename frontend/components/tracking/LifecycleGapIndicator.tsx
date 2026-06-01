'use client';

import { AlertCircle, AlertTriangle } from 'lucide-react';
import {
  detectLifecycleGaps,
  hasCriticalGaps,
  getGapSummary,
} from '@/lib/services/lifecycleGapDetector';
import type { TrackingEvent } from '@/lib/types';

interface LifecycleGapIndicatorProps {
  events: TrackingEvent[];
}

export function LifecycleGapIndicator({ events }: LifecycleGapIndicatorProps) {
  const analysis = detectLifecycleGaps(events);

  if (!analysis.hasGaps) {
    return (
      <div className="rounded-lg bg-green-50 p-4 border border-green-200">
        <p className="text-sm text-green-800">✓ Product lifecycle is complete</p>
      </div>
    );
  }

  const isCritical = hasCriticalGaps(analysis);
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';
  const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';

  return (
    <div className={`rounded-lg ${bgColor} p-4 border ${borderColor}`}>
      <div className="flex items-start gap-3">
        <Icon
          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}
        />
        <div className="flex-1">
          <p className={`text-sm font-medium ${textColor}`}>{getGapSummary(analysis)}</p>
          <div className="mt-2 space-y-1">
            {analysis.gaps.map((gap, idx) => (
              <p key={idx} className={`text-xs ${textColor}`}>
                • {gap.description}
              </p>
            ))}
          </div>
          <div className="mt-3 bg-white bg-opacity-50 rounded px-2 py-1">
            <p className={`text-xs font-semibold ${textColor}`}>
              Lifecycle Completion: {analysis.completionPercentage}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
