/**
 * Contract error catalog for Supply-Link (#390).
 *
 * Maps Soroban contract error codes to human-readable titles, messages,
 * and a `recoverable` flag that indicates whether the user can retry.
 *
 * Error codes mirror the `ContractError` enum in lib.rs.
 */

export interface ContractErrorInfo {
  title: string;
  message: string;
  /** true = user can fix the input and retry; false = action is blocked */
  recoverable: boolean;
}

export const CONTRACT_ERROR_CODES: Record<number, ContractErrorInfo> = {
  1: {
    title: "Product not found",
    message: "No product with this ID exists on-chain.",
    recoverable: false,
  },
  2: {
    title: "Product already exists",
    message: "A product with this ID is already registered.",
    recoverable: true,
  },
  3: {
    title: "Unauthorized",
    message: "Your wallet is not authorized to perform this action.",
    recoverable: false,
  },
  4: {
    title: "Ownership mismatch",
    message:
      "The provided owner address does not match the current owner.",
    recoverable: false,
  },
  5: {
    title: "Invalid event payload",
    message: "The event data is malformed or missing required fields.",
    recoverable: true,
  },
  6: {
    title: "Product recalled",
    message:
      "This product has been recalled and cannot receive new events.",
    recoverable: false,
  },
  7: {
    title: "Self-transfer not allowed",
    message:
      "The new owner must be a different address from the current owner.",
    recoverable: true,
  },
};

/**
 * Parse a Soroban contract error from an unknown thrown value.
 *
 * Soroban surfaces contract errors as strings like `"Error(Contract, #1)"`.
 * Returns `null` when the error is not a recognised contract error.
 */
export function parseContractError(
  error: unknown
): (ContractErrorInfo & { code: number }) | null {
  if (typeof error !== "string" && !(error instanceof Error)) return null;

  const msg = error instanceof Error ? error.message : error;
  const match = msg.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!match) return null;

  const code = parseInt(match[1], 10);
  const info = CONTRACT_ERROR_CODES[code];
  return info ? { code, ...info } : null;
}
