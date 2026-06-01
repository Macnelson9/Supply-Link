/**
 * Contract pause (emergency stop) service.
 *
 * Provides helpers for querying and toggling the contract's paused state.
 * When paused, all write operations are blocked on-chain. Read operations
 * remain available.
 */

export interface ContractPauseState {
  paused: boolean;
  pausedBy?: string;
  pausedAt?: number;
  reason?: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch the current contract pause state. */
export async function getContractPauseState(): Promise<ContractPauseState> {
  const res = await fetch('/api/v1/contract/pause');
  if (!res.ok) throw new Error(`Failed to fetch pause state: ${res.statusText}`);
  return res.json();
}

/** Set the contract pause state. Restricted to authorized guardians. */
export async function setContractPauseState(
  paused: boolean,
  reason?: string,
): Promise<ContractPauseState> {
  const res = await fetch('/api/v1/contract/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Failed to set pause state: ${res.statusText}`);
  }
  return res.json();
}
