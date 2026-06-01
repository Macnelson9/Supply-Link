import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getContractPauseState,
  setContractPauseState,
} from '@/lib/services/contractPause';

// ── Mock fetch ────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── getContractPauseState ─────────────────────────────────────────────────────

describe('getContractPauseState', () => {
  it('returns paused=false when contract is running normally', async () => {
    mockFetch({ paused: false });
    const state = await getContractPauseState();
    expect(state.paused).toBe(false);
  });

  it('returns paused=true with metadata when contract is paused', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch({ paused: true, pausedBy: 'GGUARDIAN1', pausedAt: now, reason: 'security incident' });
    const state = await getContractPauseState();
    expect(state.paused).toBe(true);
    expect(state.reason).toBe('security incident');
    expect(state.pausedBy).toBe('GGUARDIAN1');
  });

  it('throws when the API returns an error', async () => {
    mockFetch({}, false, 500);
    await expect(getContractPauseState()).rejects.toThrow('Failed to fetch pause state');
  });
});

// ── setContractPauseState ─────────────────────────────────────────────────────

describe('setContractPauseState', () => {
  it('sends paused=true with reason and returns updated state', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch({ paused: true, pausedAt: now, reason: 'attack detected' });
    const state = await setContractPauseState(true, 'attack detected');
    expect(state.paused).toBe(true);
    expect(state.reason).toBe('attack detected');

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.paused).toBe(true);
    expect(body.reason).toBe('attack detected');
  });

  it('sends paused=false to resume operations', async () => {
    mockFetch({ paused: false });
    const state = await setContractPauseState(false);
    expect(state.paused).toBe(false);
  });

  it('throws with server error message when API rejects', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: 'Not a guardian' }),
    } as Response);
    await expect(setContractPauseState(true)).rejects.toThrow('Not a guardian');
  });
});
