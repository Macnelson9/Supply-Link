'use client';

import { useState } from 'react';
import type { GuardianHandoverProposal } from '@/lib/types';
import { guardianHandoverClient } from '@/lib/stellar/guardianHandover';

interface Props {
  productId: string;
  walletAddress: string;
  proposal: GuardianHandoverProposal | null;
  onUpdate: () => void;
}

/**
 * Guardian handover and emergency key rotation UI (#478).
 * Allows the current guardian to propose a handover or rotate their key.
 * The proposed guardian can accept the handover from this panel.
 */
export function GuardianHandoverPanel({ productId, walletAddress, proposal, onUpdate }: Props) {
  const [proposedGuardian, setProposedGuardian] = useState('');
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'handover' | 'rotate'>('handover');

  const isCurrentGuardian = !proposal || proposal.currentGuardian === walletAddress;
  const isProposedGuardian = proposal?.proposedGuardian === walletAddress;

  async function handlePropose() {
    if (!proposedGuardian.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await guardianHandoverClient.proposeHandover(productId, proposedGuardian.trim(), walletAddress);
      setProposedGuardian('');
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to propose handover');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      await guardianHandoverClient.acceptHandover(productId, walletAddress);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept handover');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      await guardianHandoverClient.cancelHandover(productId, walletAddress);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel handover');
    } finally {
      setLoading(false);
    }
  }

  async function handleRotateKey() {
    if (!newKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await guardianHandoverClient.rotateGuardianKey(productId, newKey.trim(), walletAddress);
      setNewKey('');
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate guardian key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="guardian-panel-heading"
      className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4 space-y-4"
    >
      <h3
        id="guardian-panel-heading"
        className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide"
      >
        Guardian Management
      </h3>

      {/* Active proposal status */}
      {proposal && proposal.status === 'proposed' && (
        <div
          role="status"
          className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 text-sm"
        >
          <p className="font-medium text-yellow-800 dark:text-yellow-300">Pending handover</p>
          <p className="text-yellow-700 dark:text-yellow-400 mt-1 font-mono text-xs break-all">
            To: {proposal.proposedGuardian}
          </p>
        </div>
      )}

      {/* Accept handover (proposed guardian) */}
      {isProposedGuardian && proposal?.status === 'proposed' && (
        <button
          onClick={handleAccept}
          disabled={loading}
          className="w-full rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 transition-colors"
        >
          {loading ? 'Accepting…' : 'Accept Guardian Handover'}
        </button>
      )}

      {/* Cancel handover (current guardian) */}
      {isCurrentGuardian && proposal?.status === 'proposed' && (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-sm font-medium py-2 px-4 transition-colors"
        >
          {loading ? 'Cancelling…' : 'Cancel Handover'}
        </button>
      )}

      {/* Mode toggle */}
      {isCurrentGuardian && !proposal && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setMode('handover')}
            className={`px-3 py-1 rounded-full border transition-colors ${
              mode === 'handover'
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'border-[var(--card-border)] text-[var(--muted)]'
            }`}
          >
            Propose Handover
          </button>
          <button
            onClick={() => setMode('rotate')}
            className={`px-3 py-1 rounded-full border transition-colors ${
              mode === 'rotate'
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'border-[var(--card-border)] text-[var(--muted)]'
            }`}
          >
            Emergency Key Rotation
          </button>
        </div>
      )}

      {/* Propose handover form */}
      {isCurrentGuardian && !proposal && mode === 'handover' && (
        <div className="space-y-2">
          <label htmlFor="proposed-guardian" className="text-xs text-[var(--muted)]">
            New guardian address
          </label>
          <input
            id="proposed-guardian"
            type="text"
            value={proposedGuardian}
            onChange={(e) => setProposedGuardian(e.target.value)}
            placeholder="G…"
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
          />
          <button
            onClick={handlePropose}
            disabled={loading || !proposedGuardian.trim()}
            className="w-full rounded-md bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 disabled:opacity-50 text-sm font-medium py-2 px-4 transition-opacity"
          >
            {loading ? 'Proposing…' : 'Propose Handover'}
          </button>
        </div>
      )}

      {/* Emergency key rotation form */}
      {isCurrentGuardian && !proposal && mode === 'rotate' && (
        <div className="space-y-2">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Emergency use only. This immediately replaces the guardian key.
          </p>
          <label htmlFor="new-guardian-key" className="text-xs text-[var(--muted)]">
            New guardian key
          </label>
          <input
            id="new-guardian-key"
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="G…"
            className="w-full rounded-md border border-red-300 dark:border-red-700 bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={handleRotateKey}
            disabled={loading || !newKey.trim()}
            className="w-full rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 transition-colors"
          >
            {loading ? 'Rotating…' : 'Rotate Guardian Key'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
