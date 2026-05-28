'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { useStore } from '@/lib/state/store';
import { useAuditMode } from '@/lib/hooks/useAuditMode';
import { stellarAddressSchema } from '@/lib/validators';
import type { Delegation } from '@/lib/types';

interface DelegationPanelProps {
  productId: string;
  initialDelegations?: Delegation[];
}

function isValidAddress(addr: string) {
  return stellarAddressSchema.safeParse(addr).success;
}

function formatExpiry(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

export function DelegationPanel({ productId, initialDelegations = [] }: DelegationPanelProps) {
  const walletAddress = useStore((s) => s.walletAddress);
  const isAudit = useAuditMode();

  const [delegations, setDelegations] = useState<Delegation[]>(initialDelegations);
  const [delegatee, setDelegatee] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [inputError, setInputError] = useState('');
  const [txError, setTxError] = useState('');
  const [pending, setPending] = useState<string | null>(null); // delegatee or delegation_id

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setTxError('');
    const addr = delegatee.trim().toUpperCase();
    if (!isValidAddress(addr)) {
      setInputError('Invalid Stellar address');
      return;
    }
    if (!walletAddress) {
      setTxError('Connect your wallet first');
      return;
    }

    const days = parseInt(expiryDays, 10);
    if (isNaN(days) || days < 1) {
      setInputError('Expiry must be at least 1 day');
      return;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + days * 86400;
    const optimistic: Delegation = {
      delegationId: Date.now(),
      productId,
      delegator: walletAddress,
      delegatee: addr,
      expiresAt,
      revoked: false,
      createdAt: Math.floor(Date.now() / 1000),
    };

    setPending(addr);
    setDelegations((prev) => [...prev, optimistic]);
    setDelegatee('');
    setInputError('');

    try {
      // Contract call stub — replace with real Soroban call when wired
      await fetch(`/api/v1/products/${productId}/delegations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegatee: addr, expiresAt }),
      });
    } catch {
      setDelegations((prev) => prev.filter((d) => d.delegationId !== optimistic.delegationId));
      setTxError('Failed to create delegation. Please try again.');
    } finally {
      setPending(null);
    }
  }

  async function handleRevoke(delegationId: number) {
    setTxError('');
    if (!walletAddress) {
      setTxError('Connect your wallet first');
      return;
    }

    setPending(String(delegationId));
    setDelegations((prev) =>
      prev.map((d) => (d.delegationId === delegationId ? { ...d, revoked: true } : d)),
    );

    try {
      await fetch(`/api/v1/products/${productId}/delegations/${delegationId}`, {
        method: 'DELETE',
      });
    } catch {
      setDelegations((prev) =>
        prev.map((d) => (d.delegationId === delegationId ? { ...d, revoked: false } : d)),
      );
      setTxError('Failed to revoke delegation. Please try again.');
    } finally {
      setPending(null);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const active = delegations.filter((d) => !d.revoked && d.expiresAt > now);
  const inactive = delegations.filter((d) => d.revoked || d.expiresAt <= now);

  return (
    <div className="flex flex-col gap-4">
      {/* Active delegations */}
      {active.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active delegations.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((d) => (
            <li
              key={d.delegationId}
              className="flex items-center justify-between gap-3 bg-[var(--muted-bg)] rounded-md px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-[var(--foreground)] truncate">
                  {d.delegatee.slice(0, 8)}…{d.delegatee.slice(-6)}
                </p>
                <p className="text-xs text-[var(--muted)] flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> Expires {formatExpiry(d.expiresAt)}
                </p>
              </div>
              {!isAudit && (
                <button
                  onClick={() => handleRevoke(d.delegationId)}
                  disabled={pending !== null}
                  aria-label={`Revoke delegation for ${d.delegatee}`}
                  className="shrink-0 p-1.5 rounded hover:bg-red-100 hover:text-red-600 text-[var(--muted)] disabled:opacity-40 transition-colors"
                >
                  {pending === String(d.delegationId) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Expired / revoked (collapsed) */}
      {inactive.length > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {inactive.length} expired or revoked delegation{inactive.length !== 1 ? 's' : ''} (hidden)
        </p>
      )}

      {/* Add delegation form — hidden in audit mode */}
      {!isAudit && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-2 border-t border-[var(--card-border)] pt-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={delegatee}
              onChange={(e) => {
                setDelegatee(e.target.value);
                setInputError('');
              }}
              placeholder="G... Stellar address"
              className="flex-1 border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <input
              type="number"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              min={1}
              max={365}
              title="Expiry in days"
              className="w-20 border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              disabled={pending !== null || !delegatee.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {pending && pending.length > 10 ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Delegate
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">Days until expiry (1–365)</p>
          {inputError && <p className="text-xs text-red-500">{inputError}</p>}
          {txError && <p className="text-xs text-red-500">{txError}</p>}
        </form>
      )}
    </div>
  );
}
