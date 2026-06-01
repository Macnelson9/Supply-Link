'use client';

import type { ValidationStatus } from '@/lib/types';

interface Props {
  status: ValidationStatus;
}

const CONFIG: Record<ValidationStatus, { label: string; className: string }> = {
  pending: {
    label: 'Validation pending',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  },
  passed: {
    label: 'Validated',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700',
  },
  failed: {
    label: 'Validation failed',
    className:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
  },
  skipped: {
    label: 'Validation skipped',
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
};

/**
 * Small inline badge showing the async validation status of an event (#475).
 */
export function ValidationStatusBadge({ status }: Props) {
  const { label, className } = CONFIG[status];
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {status === 'pending' && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
