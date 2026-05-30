/**
 * Pre-transfer compliance validation
 *
 * Defines the conditions that must be satisfied before an ownership transfer
 * is allowed. Each check returns a structured result so the UI can surface
 * exactly why a transfer is blocked.
 *
 * Checks performed (in order):
 *   1. Product must be active (not deactivated)
 *   2. Product must not be recalled
 *   3. Product must not be spoiled / expired
 *   4. Product must not have a pending ownership transfer escrow
 *   5. Product must have at least one active (non-revoked) certification
 *      when the category requires it (configurable per category)
 *   6. New owner address must differ from current owner
 *
 * The result carries a list of violations so the UI can show all blockers
 * at once rather than one at a time.
 */

import type { Product } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComplianceViolationCode =
  | 'PRODUCT_INACTIVE'
  | 'PRODUCT_RECALLED'
  | 'PRODUCT_SPOILED'
  | 'PRODUCT_EXPIRED'
  | 'PENDING_TRANSFER_EXISTS'
  | 'MISSING_REQUIRED_CERTIFICATION'
  | 'SAME_OWNER'
  | 'WALLET_NOT_CONNECTED';

export interface ComplianceViolation {
  code: ComplianceViolationCode;
  /** Human-readable explanation shown in the UI */
  message: string;
  /** Whether this is a hard block (true) or a soft warning (false) */
  blocking: boolean;
}

export interface TransferComplianceResult {
  /** True only when there are zero blocking violations */
  allowed: boolean;
  violations: ComplianceViolation[];
  /** Convenience: violations that block the transfer */
  blockers: ComplianceViolation[];
  /** Convenience: non-blocking warnings */
  warnings: ComplianceViolation[];
}

// ── Category certification requirements ───────────────────────────────────────

/**
 * Categories that require at least one active certification before transfer.
 * Extend this map as new regulated categories are added.
 */
const CERTIFICATION_REQUIRED_CATEGORIES: ReadonlySet<string> = new Set([
  'agricultural',
  'pharmaceutical',
  'food',
  'cosmetics',
]);

// ── Individual checks ─────────────────────────────────────────────────────────

function checkActive(product: Product): ComplianceViolation | null {
  if (product.active === false) {
    return {
      code: 'PRODUCT_INACTIVE',
      message: 'This product has been deactivated and cannot be transferred.',
      blocking: true,
    };
  }
  return null;
}

function checkRecalled(product: Product): ComplianceViolation | null {
  if (product.recalled) {
    return {
      code: 'PRODUCT_RECALLED',
      message: `This product is under recall${product.recallReason ? `: "${product.recallReason}"` : ''}. Transfers are blocked until the recall is lifted.`,
      blocking: true,
    };
  }
  return null;
}

function checkSpoiled(product: Product): ComplianceViolation | null {
  if (product.spoiled) {
    return {
      code: 'PRODUCT_SPOILED',
      message: 'This product has been marked as spoiled and cannot be transferred.',
      blocking: true,
    };
  }
  return null;
}

function checkExpired(product: Product): ComplianceViolation | null {
  if (
    product.expirationTimestamp &&
    product.expirationTimestamp > 0 &&
    Date.now() / 1000 >= product.expirationTimestamp
  ) {
    return {
      code: 'PRODUCT_EXPIRED',
      message: 'This product has passed its expiration date and cannot be transferred.',
      blocking: true,
    };
  }
  return null;
}

function checkCertifications(product: Product): ComplianceViolation | null {
  const category = product.category ?? '';
  if (!CERTIFICATION_REQUIRED_CATEGORIES.has(category)) return null;

  const certs = product.certifications ?? [];
  const hasActive = certs.some((c) => !c.revoked);

  if (!hasActive) {
    return {
      code: 'MISSING_REQUIRED_CERTIFICATION',
      message: `Products in the "${category}" category require at least one active certification before transfer. Please issue a certification first.`,
      blocking: true,
    };
  }
  return null;
}

function checkSameOwner(product: Product, newOwner: string): ComplianceViolation | null {
  if (newOwner.toUpperCase() === product.owner.toUpperCase()) {
    return {
      code: 'SAME_OWNER',
      message: 'The new owner address is the same as the current owner.',
      blocking: true,
    };
  }
  return null;
}

function checkWalletConnected(walletAddress: string | null): ComplianceViolation | null {
  if (!walletAddress) {
    return {
      code: 'WALLET_NOT_CONNECTED',
      message: 'Connect your wallet before initiating a transfer.',
      blocking: true,
    };
  }
  return null;
}

// ── Main validator ────────────────────────────────────────────────────────────

export interface TransferComplianceInput {
  product: Product;
  newOwner: string;
  walletAddress: string | null;
  /** Pass true if a pending escrow already exists for this product */
  hasPendingEscrow?: boolean;
}

/**
 * Run all pre-transfer compliance checks and return a structured result.
 * The caller decides whether to block the UI or proceed.
 */
export function checkTransferCompliance(
  input: TransferComplianceInput,
): TransferComplianceResult {
  const { product, newOwner, walletAddress, hasPendingEscrow } = input;

  const raw: Array<ComplianceViolation | null> = [
    checkWalletConnected(walletAddress),
    checkActive(product),
    checkRecalled(product),
    checkSpoiled(product),
    checkExpired(product),
    checkCertifications(product),
    checkSameOwner(product, newOwner),
  ];

  if (hasPendingEscrow) {
    raw.push({
      code: 'PENDING_TRANSFER_EXISTS',
      message: 'A transfer request is already pending for this product. Cancel it before initiating a new one.',
      blocking: true,
    });
  }

  const violations = raw.filter((v): v is ComplianceViolation => v !== null);
  const blockers = violations.filter((v) => v.blocking);
  const warnings = violations.filter((v) => !v.blocking);

  return {
    allowed: blockers.length === 0,
    violations,
    blockers,
    warnings,
  };
}
