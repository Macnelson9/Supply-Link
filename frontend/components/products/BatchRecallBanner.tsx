import type { BatchWithRecall } from '@/lib/types';

interface BatchRecallBannerProps {
  /** Batches that contain this product and have been recalled. */
  recalledBatches: BatchWithRecall[];
}

/**
 * Displays a warning banner when one or more batches containing this product
 * have been recalled. Renders nothing when no recalled batches are present.
 *
 * Each recalled batch is shown as a separate entry with its ID, reason, and
 * recall timestamp.
 */
export function BatchRecallBanner({ recalledBatches }: BatchRecallBannerProps) {
  if (recalledBatches.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-lg border border-orange-500 bg-orange-50 px-4 py-3 text-orange-900 dark:border-orange-400 dark:bg-orange-950 dark:text-orange-100"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">
            Batch Recall{recalledBatches.length > 1 ? 's' : ''} Affecting This Product
          </p>
          <p className="text-xs mt-0.5 text-orange-700 dark:text-orange-300">
            This product belongs to{' '}
            {recalledBatches.length === 1
              ? 'a recalled batch'
              : `${recalledBatches.length} recalled batches`}
            . Review the details below.
          </p>
        </div>
      </div>

      {/* Per-batch details */}
      <ul className="flex flex-col gap-2 pl-8">
        {recalledBatches.map((batch) => {
          const recalledAt =
            batch.recallTimestamp > 0
              ? new Date(batch.recallTimestamp * 1000).toLocaleString()
              : null;

          return (
            <li
              key={batch.id}
              className="border border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 bg-orange-100/50 dark:bg-orange-900/30"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-orange-900 dark:text-orange-100">
                    {batch.name}
                  </p>
                  <p className="text-xs font-mono text-orange-700 dark:text-orange-400 mt-0.5">
                    Batch ID: {batch.id}
                  </p>
                </div>
                {recalledAt && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 shrink-0">
                    {recalledAt}
                  </p>
                )}
              </div>
              {batch.recallReason && (
                <p className="text-xs mt-1.5 text-orange-800 dark:text-orange-200">
                  <span className="font-medium">Reason:</span> {batch.recallReason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default BatchRecallBanner;
