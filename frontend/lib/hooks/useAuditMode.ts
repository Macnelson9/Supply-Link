'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Returns true when the app is in read-only audit mode.
 * Activated by appending ?audit=1 to any app URL.
 */
export function useAuditMode(): boolean {
  const params = useSearchParams();
  return params.get('audit') === '1';
}
