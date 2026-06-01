'use client';

import { useEffect, useState } from 'react';
import { contractClient } from '@/lib/stellar/contract';
import { useStore } from '@/lib/state/store';

interface SignerProofBadgeProps {
  eventStableId: string;
}

interface ProofData {
  signer: string;
  payloadHash: string;
  timestamp: number;
}

/**
 * Displays on-chain signer proof for a tracking event (#402).
 * Shows the signer address and payload hash so third parties can verify
 * the event without trusting the application.
 */
export default function SignerProofBadge({ eventStableId }: SignerProofBadgeProps) {
  const [proof, setProof] = useState<ProofData | null>(null);
  const [open, setOpen] = useState(false);
  const walletAddress = useStore((s) => s.walletAddress);

  useEffect(() => {
    if (!open || !walletAddress) return;
    contractClient
      .getSignerProof(eventStableId, walletAddress)
      .then(setProof)
      .catch(() => setProof(null));
  }, [open, eventStableId, walletAddress]);

  return (
    <div className="inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-0.5 rounded border border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
        title="View signer proof"
      >
        🔏 Proof
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs space-y-1 max-w-sm">
          <p className="font-semibold text-[var(--foreground)]">Signer Proof</p>
          {proof ? (
            <>
              <p className="text-[var(--muted)]">
                <span className="font-medium">Signer:</span>{' '}
                <span className="font-mono break-all">{proof.signer}</span>
              </p>
              <p className="text-[var(--muted)]">
                <span className="font-medium">Payload hash:</span>{' '}
                <span className="font-mono break-all">{proof.payloadHash}</span>
              </p>
              <p className="text-[var(--muted)]">
                <span className="font-medium">Recorded at:</span>{' '}
                {new Date(proof.timestamp * 1000).toISOString()}
              </p>
            </>
          ) : (
            <p className="text-[var(--muted)]">Loading proof…</p>
          )}
        </div>
      )}
    </div>
  );
}
