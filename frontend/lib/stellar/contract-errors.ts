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
    title: 'Product not found',
    message: 'No product with this ID exists on-chain.',
    recoverable: false,
  },
  2: {
    title: 'Product already exists',
    message: 'A product with this ID is already registered.',
    recoverable: true,
  },
  3: {
    title: 'Unauthorized',
    message: 'Your wallet is not authorized to perform this action.',
    recoverable: false,
  },
  4: {
    title: 'Ownership mismatch',
    message: 'The provided owner address does not match the current owner.',
    recoverable: false,
  },
  5: {
    title: 'Invalid event payload',
    message: 'The event data is malformed or missing required fields.',
    recoverable: true,
  },
  6: {
    title: 'Product recalled',
    message: 'This product has been recalled and cannot receive new events.',
    recoverable: false,
  },
  7: {
    title: 'Self-transfer not allowed',
    message: 'The new owner must be a different address from the current owner.',
    recoverable: true,
  },
};

/**
 * Parse a Soroban contract error from an unknown thrown value.
 *
 * Soroban surfaces contract errors as strings like `"Error(Contract, #1)"`.
 * Returns `null` when the error is not a recognised contract error.
 */
export function parseContractError(error: unknown): (ContractErrorInfo & { code: number }) | null {
  if (typeof error !== 'string' && !(error instanceof Error)) return null;

  const msg = error instanceof Error ? error.message : error;
  const match = msg.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!match) return null;

  const code = parseInt(match[1], 10);
  const info = CONTRACT_ERROR_CODES[code];
  return info ? { code, ...info } : null;
}

/**
 * Stable error codes emitted by the Supply-Link Soroban contract.
 *
 * These map 1-to-1 to the `#[contracterror]` enum in the Rust contract.
 * Use these constants for deterministic error handling instead of string matching.
 */
export const ContractErrorCode = {
  ProductNotFound: 1,
  NotAuthorized: 2,
  ApproverNotAuthorized: 3,
  NoPendingEvents: 4,
  OwnerOnly: 5,
  PendingEventExpired: 6,
  InvalidNonce: 7,
  /** #401: Duplicate event hash detected — replay attempt rejected. */
  DuplicateEvent: 8,
} as const;

export type ContractErrorCode = (typeof ContractErrorCode)[keyof typeof ContractErrorCode];

export interface MappedContractError {
  code: ContractErrorCode;
  /** Stable machine-readable key */
  key: string;
  /** Default English message — replace with i18n lookup in UI */
  message: string;
  /** Suggested HTTP status for API responses */
  httpStatus: number;
}

const ERROR_MAP: Record<ContractErrorCode, MappedContractError> = {
  [ContractErrorCode.ProductNotFound]: {
    code: ContractErrorCode.ProductNotFound,
    key: 'PRODUCT_NOT_FOUND',
    message: 'The requested product does not exist on-chain.',
    httpStatus: 404,
  },
  [ContractErrorCode.NotAuthorized]: {
    code: ContractErrorCode.NotAuthorized,
    key: 'NOT_AUTHORIZED',
    message: 'You are not authorized to perform this action on this product.',
    httpStatus: 403,
  },
  [ContractErrorCode.ApproverNotAuthorized]: {
    code: ContractErrorCode.ApproverNotAuthorized,
    key: 'APPROVER_NOT_AUTHORIZED',
    message: 'The approver is not the product owner or an authorized actor.',
    httpStatus: 403,
  },
  [ContractErrorCode.NoPendingEvents]: {
    code: ContractErrorCode.NoPendingEvents,
    key: 'NO_PENDING_EVENTS',
    message: 'There are no pending events in the approval queue for this product.',
    httpStatus: 404,
  },
  [ContractErrorCode.OwnerOnly]: {
    code: ContractErrorCode.OwnerOnly,
    key: 'OWNER_ONLY',
    message: 'Only the product owner can perform this action.',
    httpStatus: 403,
  },
  [ContractErrorCode.PendingEventExpired]: {
    code: ContractErrorCode.PendingEventExpired,
    key: 'PENDING_EVENT_EXPIRED',
    message: 'This pending event has expired and can no longer be approved.',
    httpStatus: 410,
  },
  [ContractErrorCode.InvalidNonce]: {
    code: ContractErrorCode.InvalidNonce,
    key: 'INVALID_NONCE',
    message: 'The supplied nonce does not match the expected sequential value. Refresh and retry.',
    httpStatus: 409,
  },
  [ContractErrorCode.DuplicateEvent]: {
    code: ContractErrorCode.DuplicateEvent,
    key: 'DUPLICATE_EVENT',
    message: 'This event has already been recorded on-chain. Replay attempt rejected.',
    httpStatus: 409,
  },
};

/**
 * Translation key for a contract error, suitable for `useTranslations()` /
 * `getTranslations()` lookups under the `errors` namespace. Returns
 * `errors.UNKNOWN` when the error is not a recognised contract error code.
 *
 * @example
 *   const t = useTranslations("errors");
 *   toast.error(t(contractErrorI18nKey(err).replace("errors.", "")));
 */
export function contractErrorI18nKey(error: unknown): string {
  const mapped = mapContractError(error);
  return `errors.${mapped?.key ?? 'UNKNOWN'}`;
}

/**
 * Extract the numeric error code from a Soroban invocation error.
 *
 * Soroban encodes contract errors as `Error(Contract, <code>)` in the
 * diagnostic events and as a numeric value in the result XDR.
 * This function handles the common shapes returned by the Stellar SDK.
 */
export function extractContractErrorCode(error: unknown): ContractErrorCode | null {
  if (typeof error !== 'object' || error === null) return null;

  // Shape from @stellar/stellar-sdk: { code: number } or { result: { code: number } }
  const e = error as Record<string, unknown>;

  const code =
    typeof e['code'] === 'number'
      ? e['code']
      : typeof (e['result'] as Record<string, unknown>)?.['code'] === 'number'
        ? (e['result'] as Record<string, unknown>)['code']
        : null;

  if (code === null) return null;
  return code in ERROR_MAP ? (code as ContractErrorCode) : null;
}

/**
 * Map a raw contract invocation error to a structured `MappedContractError`.
 * Returns `null` if the error is not a recognised contract error code.
 */
export function mapContractError(error: unknown): MappedContractError | null {
  const code = extractContractErrorCode(error);
  return code !== null ? ERROR_MAP[code] : null;
}
