import type { Product } from "@/lib/types";

interface RecallBannerProps {
  product: Product;
}

/**
 * Displays a prominent red warning banner when a product has been recalled (#393).
 * Renders nothing when the product is not recalled.
 */
export function RecallBanner({ product }: RecallBannerProps) {
  if (!product.recalled) return null;

  const recalledAt = product.recallTimestamp
    ? new Date(product.recallTimestamp * 1000).toLocaleString()
    : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-red-800 dark:border-red-400 dark:bg-red-950 dark:text-red-200"
    >
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Product Recalled</p>
        {product.recallReason && (
          <p className="mt-0.5 text-sm">
            <span className="font-medium">Reason:</span> {product.recallReason}
          </p>
        )}
        {recalledAt && (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
            Recalled at {recalledAt}
          </p>
        )}
      </div>
    </div>
  );
}

export default RecallBanner;
