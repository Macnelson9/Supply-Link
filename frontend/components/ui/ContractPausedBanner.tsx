'use client';

import { useEffect, useState } from 'react';
import { ShieldOff, Loader2 } from 'lucide-react';
import { getContractPauseState, type ContractPauseState } from '@/lib/services/contractPause';

/**
 * Displays a full-width banner when the contract is in emergency-stop (paused) state.
 * Renders nothing when the contract is operating normally.
 * Polls every 30 seconds so the UI stays in sync without a page reload.
 */
export function ContractPausedBanner() {
  const [state, setState] = useState<ContractPauseState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await getContractPauseState();
        if (!cancelled) setState(s);
      } catch {
        // Silently ignore — don't disrupt the app if the endpoint is unreachable
      }
    }

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!state) {
    return null; // Loading or fetch failed — don't show anything
  }

  if (!state.paused) return null;

  const pausedAt = state.pausedAt
    ? new Date(state.pausedAt * 1000).toLocaleString()
    : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 px-4 py-3 bg-red-600 text-white border-b border-red-700"
    >
      <ShieldOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          System Paused — Write Operations Disabled
        </p>
        <p className="text-xs text-red-100 mt-0.5">
          An authorized guardian has halted contract write operations.
          Product registration, event submission, and transfers are temporarily unavailable.
          Read-only access remains active.
          {state.reason && (
            <> Reason: <span className="font-medium">{state.reason}</span>.</>
          )}
          {pausedAt && (
            <> Paused at {pausedAt}.</>
          )}
        </p>
      </div>
    </div>
  );
}
