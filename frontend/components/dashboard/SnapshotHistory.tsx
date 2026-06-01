'use client';

import { useEffect, useState } from 'react';
import { contractClient } from '@/lib/stellar/contract';
import { useStore } from '@/lib/state/store';

interface Snapshot {
  id: string;
  product_id: string;
  snapshot_hash: string;
  created_by: string;
  timestamp: number;
  event_count: number;
}

interface SnapshotHistoryProps {
  productId: string;
}

/**
 * Displays the audit snapshot history for a product (#400).
 */
export default function SnapshotHistory({ productId }: SnapshotHistoryProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const walletAddress = useStore((s) => s.walletAddress);

  useEffect(() => {
    if (!walletAddress) return;
    contractClient
      .getSnapshots(productId, walletAddress)
      .then((raw) => setSnapshots(raw as Snapshot[]))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [productId, walletAddress]);

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading snapshots…</p>;
  if (snapshots.length === 0)
    return <p className="text-sm text-[var(--muted)]">No audit snapshots yet.</p>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">Audit Snapshots</h3>
      {snapshots.map((s) => (
        <div
          key={s.id}
          className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs space-y-1"
        >
          <div className="flex justify-between items-center">
            <span className="font-medium text-[var(--foreground)]">
              {new Date(s.timestamp * 1000).toLocaleString()}
            </span>
            <span className="text-[var(--muted)]">{s.event_count} events</span>
          </div>
          <p className="text-[var(--muted)] font-mono break-all">{s.snapshot_hash}</p>
          <p className="text-[var(--muted)]">
            By: <span className="font-mono">{s.created_by.slice(0, 12)}…</span>
          </p>
        </div>
      ))}
    </div>
  );
}
