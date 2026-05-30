'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertTriangle, ShieldX, ShieldCheck, Info } from 'lucide-react';
import { useStore } from '@/lib/state/store';
import { transferOwnership } from '@/lib/stellar/client';
import { stellarAddressSchema } from '@/lib/validators';
import { invalidateProductCache } from '@/lib/services/productReadModel';
import { recordApprovalEvent } from '@/lib/api/approvalLog';
import type { ComplianceViolation } from '@/lib/transferCompliance';

const schema = z.object({
  newOwner: stellarAddressSchema,
});

type FormValues = z.infer<typeof schema>;

interface TransferOwnershipFormProps {
  productId: string;
  currentOwner: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ── Compliance banner ─────────────────────────────────────────────────────────

function ComplianceBanner({ violations }: { violations: ComplianceViolation[] }) {
  if (violations.length === 0) return null;

  const blockers = violations.filter((v) => v.blocking);
  const warnings = violations.filter((v) => !v.blocking);

  return (
    <div className="flex flex-col gap-2">
      {blockers.length > 0 && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldX size={14} className="text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
              Transfer blocked
            </span>
          </div>
          <ul className="space-y-1">
            {blockers.map((v) => (
              <li key={v.code} className="text-xs text-red-700 dark:text-red-300 flex gap-1.5">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Info size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Warnings
            </span>
          </div>
          <ul className="space-y-1">
            {warnings.map((v) => (
              <li key={v.code} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function TransferOwnershipForm({
  productId,
  currentOwner,
  onSuccess,
  onCancel,
}: TransferOwnershipFormProps) {
  const walletAddress = useStore((s) => s.walletAddress);
  const updateProductOwner = useStore((s) => s.updateProductOwner);

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState('');
  const [pendingOwner, setPendingOwner] = useState('');

  // Compliance preflight state
  const [complianceViolations, setComplianceViolations] = useState<ComplianceViolation[]>([]);
  const [complianceChecking, setComplianceChecking] = useState(false);
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [complianceAllowed, setComplianceAllowed] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchedOwner = watch('newOwner', '');

  // Run preflight whenever the address changes (debounced)
  const runPreflight = useCallback(
    async (newOwner: string) => {
      // Only check when address looks like a valid Stellar key
      if (!newOwner || !/^G[A-D][A-Z2-7]{54}$/.test(newOwner)) {
        setComplianceChecked(false);
        setComplianceViolations([]);
        return;
      }

      setComplianceChecking(true);
      try {
        const res = await fetch('/api/v1/transfer-preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, newOwner, walletAddress }),
        });

        if (res.ok) {
          const data = await res.json();
          setComplianceViolations(data.violations ?? []);
          setComplianceAllowed(data.allowed ?? true);
        } else {
          // Non-fatal — let the form proceed; server will re-validate
          setComplianceViolations([]);
          setComplianceAllowed(true);
        }
      } catch {
        // Network error — don't block the UI
        setComplianceViolations([]);
        setComplianceAllowed(true);
      } finally {
        setComplianceChecking(false);
        setComplianceChecked(true);
      }
    },
    [productId, walletAddress],
  );

  // Debounce the preflight call
  useEffect(() => {
    const timer = setTimeout(() => {
      runPreflight(watchedOwner);
    }, 500);
    return () => clearTimeout(timer);
  }, [watchedOwner, runPreflight]);

  // Step 1: validate and show confirmation dialog
  function onFormSubmit({ newOwner }: FormValues) {
    if (newOwner.toUpperCase() === currentOwner.toUpperCase()) return;
    if (!complianceAllowed) return; // blocked by compliance
    setPendingOwner(newOwner.toUpperCase());
    setStep('confirm');
  }

  // Step 2: confirmed — call the contract
  async function onConfirm() {
    if (!walletAddress) {
      setTxError('Connect your wallet first.');
      setStep('form');
      return;
    }
    setSubmitting(true);
    setTxError('');
    try {
      await transferOwnership(productId, pendingOwner, walletAddress);
      invalidateProductCache(productId);
      recordApprovalEvent({
        action: 'transfer_ownership',
        productId,
        actor: walletAddress,
        target: pendingOwner,
        success: true,
      });
      updateProductOwner(productId, pendingOwner);
      onSuccess?.();
    } catch {
      recordApprovalEvent({
        action: 'transfer_ownership',
        productId,
        actor: walletAddress,
        target: pendingOwner,
        success: false,
      });
      setTxError('Transaction failed. Please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation dialog ────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">This cannot be undone.</p>
            <p>
              You are transferring ownership of{' '}
              <span className="font-mono font-medium">{productId}</span> to:
            </p>
            <p className="font-mono break-all text-xs mt-1">{pendingOwner}</p>
          </div>
        </div>

        {txError && <p className="text-xs text-red-500">{txError}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setStep('form')}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md border border-[var(--card-border)] hover:bg-[var(--muted-bg)] text-[var(--foreground)] disabled:opacity-40"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Transfer
          </button>
        </div>
      </div>
    );
  }

  // ── Address input form ─────────────────────────────────────────────────────
  const hasBlockers = complianceViolations.some((v) => v.blocking);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--foreground)]">New owner address</label>
        <div className="relative">
          <input
            {...register('newOwner')}
            type="text"
            placeholder="G… (56 characters)"
            autoComplete="off"
            spellCheck={false}
            className="w-full border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] aria-[invalid=true]:border-red-500 pr-8"
            aria-invalid={errors.newOwner ? 'true' : 'false'}
          />
          {/* Inline compliance status indicator */}
          {complianceChecking && (
            <Loader2
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]"
              aria-label="Checking compliance…"
            />
          )}
          {complianceChecked && !complianceChecking && !hasBlockers && watchedOwner && (
            <ShieldCheck
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500"
              aria-label="Compliance checks passed"
            />
          )}
          {complianceChecked && !complianceChecking && hasBlockers && (
            <ShieldX
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500"
              aria-label="Compliance checks failed"
            />
          )}
        </div>
        {errors.newOwner && <p className="text-xs text-red-500">{errors.newOwner.message}</p>}
      </div>

      {/* Compliance violations banner */}
      {complianceChecked && !complianceChecking && (
        <ComplianceBanner violations={complianceViolations} />
      )}

      {txError && <p className="text-xs text-red-500">{txError}</p>}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-[var(--card-border)] hover:bg-[var(--muted-bg)] text-[var(--foreground)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={hasBlockers || complianceChecking}
          title={hasBlockers ? 'Resolve compliance issues before transferring' : undefined}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review Transfer
        </button>
      </div>
    </form>
  );
}
