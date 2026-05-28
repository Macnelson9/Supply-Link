'use client';

import { ShieldCheck } from 'lucide-react';
import { useAuditMode } from '@/lib/hooks/useAuditMode';

/**
 * Renders a sticky banner when audit mode is active.
 * Placed inside AppNavbar so it appears on every app page.
 */
export function AuditModeBanner() {
  const isAudit = useAuditMode();
  if (!isAudit) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium"
    >
      <ShieldCheck size={15} />
      Audit Mode — read-only view. Write actions are disabled.
    </div>
  );
}
