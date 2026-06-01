'use client';

import { useState } from 'react';
import type { Attestation, Auditor } from '@/lib/types';

interface AuditorAttestationsPanelProps {
  productId: string;
  attestations: Attestation[];
  auditors: Auditor[];
}

/** Badge colour per attestation type */
const ATTESTATION_TYPE_STYLES: Record<string, string> = {
  quality_check: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  compliance_verified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  safety_approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  origin_verified: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  fair_trade_verified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  organic_certified: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
};

function getAttestationTypeStyle(type: string): string {
  return (
    ATTESTATION_TYPE_STYLES[type] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  );
}

function formatAttestationType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface AttestationCardProps {
  attestation: Attestation;
  auditor: Auditor | undefined;
}

function AttestationCard({ attestation, auditor }: AttestationCardProps) {
  const [showSignature, setShowSignature] = useState(false);
  const isProductLevel = !attestation.targetId;
  const attestedAt = new Date(attestation.timestamp * 1000).toLocaleString();

  return (
    <div className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card)] flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getAttestationTypeStyle(attestation.attestationType)}`}
            >
              {formatAttestationType(attestation.attestationType)}
            </span>
            {isProductLevel ? (
              <span className="text-xs text-[var(--muted)] bg-[var(--card-hover)] px-2 py-0.5 rounded-full border border-[var(--card-border)]">
                Product-level
              </span>
            ) : (
              <span className="text-xs text-[var(--muted)] bg-[var(--card-hover)] px-2 py-0.5 rounded-full border border-[var(--card-border)]">
                Event-level
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">{attestedAt}</p>
        </div>

        {/* Auditor info */}
        <div className="flex flex-col items-end gap-0.5">
          {auditor ? (
            <>
              <p className="text-xs font-semibold text-[var(--foreground)]">{auditor.name}</p>
              <div className="flex items-center gap-1">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${auditor.active ? 'bg-green-500' : 'bg-red-400'}`}
                  aria-hidden="true"
                />
                <span className="text-xs text-[var(--muted)]">
                  {auditor.active ? 'Active auditor' : 'Inactive auditor'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs font-mono text-[var(--muted)] break-all">
              {attestation.auditor.slice(0, 8)}…{attestation.auditor.slice(-6)}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      {attestation.notes && (
        <p className="text-sm text-[var(--foreground)] leading-relaxed">{attestation.notes}</p>
      )}

      {/* Event target */}
      {!isProductLevel && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-[var(--muted)]">Attested event</p>
          <p className="text-xs font-mono text-[var(--foreground)] break-all">
            {attestation.targetId}
          </p>
        </div>
      )}

      {/* Signature toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowSignature((v) => !v)}
          className="text-xs text-[var(--primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded"
          aria-expanded={showSignature}
        >
          {showSignature ? 'Hide signature' : 'Show signature'}
        </button>
        {showSignature && (
          <div className="mt-2 p-2 rounded-lg bg-[var(--card-hover)] border border-[var(--card-border)]">
            <p className="text-xs font-medium text-[var(--muted)] mb-1">Ed25519 signature</p>
            <code className="text-xs font-mono break-all text-[var(--foreground)]">
              {attestation.signature}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Displays all auditor attestations for a product.
 *
 * Shows both product-level and event-level attestations, grouped by type.
 * Each card shows the auditor name, attestation type badge, notes, and a
 * collapsible signature viewer for on-chain verification.
 */
export function AuditorAttestationsPanel({
  productId,
  attestations,
  auditors,
}: AuditorAttestationsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'product' | 'event'>('all');

  const auditorMap = new Map(auditors.map((a) => [a.address, a]));

  const filtered = attestations.filter((a) => {
    if (filter === 'product') return !a.targetId;
    if (filter === 'event') return !!a.targetId;
    return true;
  });

  if (attestations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-10 h-10 text-[var(--muted)] mb-3"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
          />
        </svg>
        <p className="text-sm font-medium text-[var(--foreground)]">No attestations yet</p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Registered auditors can sign attestations for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-[var(--muted)]">
          {attestations.length} attestation{attestations.length !== 1 ? 's' : ''} from{' '}
          {new Set(attestations.map((a) => a.auditor)).size} auditor
          {new Set(attestations.map((a) => a.auditor)).size !== 1 ? 's' : ''}
        </p>

        {/* Filter tabs */}
        <div
          className="flex rounded-lg border border-[var(--card-border)] overflow-hidden text-xs"
          role="group"
          aria-label="Filter attestations"
        >
          {(['all', 'product', 'event'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                filter === tab
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--card-hover)]'
              }`}
              aria-pressed={filter === tab}
            >
              {tab === 'all' ? 'All' : tab === 'product' ? 'Product' : 'Event'}
            </button>
          ))}
        </div>
      </div>

      {/* Attestation cards */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-4">
          No {filter}-level attestations.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((attestation) => (
            <AttestationCard
              key={attestation.id}
              attestation={attestation}
              auditor={auditorMap.get(attestation.auditor)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditorAttestationsPanel;
