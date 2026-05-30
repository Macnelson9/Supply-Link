/**
 * Tests for pre-transfer compliance validation:
 *   - Active product passes all checks
 *   - Inactive product is blocked
 *   - Recalled product is blocked (with reason in message)
 *   - Spoiled product is blocked
 *   - Expired product is blocked
 *   - Missing certification blocks regulated categories
 *   - Revoked-only certifications count as missing
 *   - Same owner is blocked
 *   - Wallet not connected is blocked
 *   - Pending escrow is blocked
 *   - Multiple violations are all reported
 *   - Non-regulated categories pass without certifications
 *   - Warnings are separated from blockers
 */

import { describe, it, expect } from 'vitest';
import type { Product } from '@/lib/types';
import { checkTransferCompliance } from '../transferCompliance';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PRODUCT: Product = {
  id: 'prod-001',
  name: 'Test Product',
  origin: 'Test Origin',
  owner: 'GOWNER1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
  timestamp: 1710000000000,
  active: true,
  authorizedActors: [],
  recalled: false,
  spoiled: false,
  category: 'electronics', // non-regulated — no cert required
  certifications: [],
};

const NEW_OWNER = 'GNEWOWNER1ABCDEFGHIJKLMNOPQRSTUVWXYZ123';
const WALLET = 'GOWNER1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';

function check(
  overrides: Partial<Product> = {},
  newOwner = NEW_OWNER,
  wallet: string | null = WALLET,
  hasPendingEscrow = false,
) {
  return checkTransferCompliance({
    product: { ...BASE_PRODUCT, ...overrides },
    newOwner,
    walletAddress: wallet,
    hasPendingEscrow,
  });
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('checkTransferCompliance — allowed cases', () => {
  it('allows transfer for a fully compliant product', () => {
    const result = check();
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('allows transfer for an agricultural product with an active certification', () => {
    const result = check({
      category: 'agricultural',
      certifications: [
        {
          id: 'cert-1',
          productId: 'prod-001',
          certType: 'organic',
          issuer: WALLET,
          issuedAt: Date.now(),
          revoked: false,
        },
      ],
    });
    expect(result.allowed).toBe(true);
  });

  it('allows transfer for a non-regulated category without certifications', () => {
    const result = check({ category: 'electronics', certifications: [] });
    expect(result.allowed).toBe(true);
  });
});

// ── Blocking violations ───────────────────────────────────────────────────────

describe('checkTransferCompliance — blocking violations', () => {
  it('blocks when product is inactive', () => {
    const result = check({ active: false });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PRODUCT_INACTIVE');
    expect(v).toBeDefined();
    expect(v!.blocking).toBe(true);
  });

  it('blocks when product is recalled', () => {
    const result = check({ recalled: true, recallReason: 'Contamination' });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PRODUCT_RECALLED');
    expect(v).toBeDefined();
    expect(v!.message).toContain('Contamination');
  });

  it('blocks when product is recalled without a reason', () => {
    const result = check({ recalled: true, recallReason: undefined });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PRODUCT_RECALLED');
    expect(v).toBeDefined();
  });

  it('blocks when product is spoiled', () => {
    const result = check({ spoiled: true });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PRODUCT_SPOILED');
    expect(v).toBeDefined();
  });

  it('blocks when product is expired', () => {
    // expirationTimestamp is in Unix seconds
    const pastSeconds = Math.floor(Date.now() / 1000) - 3600;
    const result = check({ expirationTimestamp: pastSeconds });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PRODUCT_EXPIRED');
    expect(v).toBeDefined();
  });

  it('does not block when expiration is in the future', () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 86400;
    const result = check({ expirationTimestamp: futureSeconds });
    expect(result.blockers.find((b) => b.code === 'PRODUCT_EXPIRED')).toBeUndefined();
  });

  it('does not block when expirationTimestamp is 0 (not set)', () => {
    const result = check({ expirationTimestamp: 0 });
    expect(result.blockers.find((b) => b.code === 'PRODUCT_EXPIRED')).toBeUndefined();
  });

  it('blocks when new owner equals current owner', () => {
    const result = check({}, BASE_PRODUCT.owner);
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'SAME_OWNER');
    expect(v).toBeDefined();
  });

  it('blocks when wallet is not connected', () => {
    const result = check({}, NEW_OWNER, null);
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'WALLET_NOT_CONNECTED');
    expect(v).toBeDefined();
  });

  it('blocks when a pending escrow exists', () => {
    const result = check({}, NEW_OWNER, WALLET, true);
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'PENDING_TRANSFER_EXISTS');
    expect(v).toBeDefined();
  });

  it('blocks agricultural product with no certifications', () => {
    const result = check({ category: 'agricultural', certifications: [] });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'MISSING_REQUIRED_CERTIFICATION');
    expect(v).toBeDefined();
    expect(v!.message).toContain('agricultural');
  });

  it('blocks agricultural product with only revoked certifications', () => {
    const result = check({
      category: 'agricultural',
      certifications: [
        {
          id: 'cert-1',
          productId: 'prod-001',
          certType: 'organic',
          issuer: WALLET,
          issuedAt: Date.now(),
          revoked: true,
        },
      ],
    });
    expect(result.allowed).toBe(false);
    const v = result.blockers.find((b) => b.code === 'MISSING_REQUIRED_CERTIFICATION');
    expect(v).toBeDefined();
  });

  it('blocks pharmaceutical product with no certifications', () => {
    const result = check({ category: 'pharmaceutical', certifications: [] });
    expect(result.allowed).toBe(false);
    expect(result.blockers.find((b) => b.code === 'MISSING_REQUIRED_CERTIFICATION')).toBeDefined();
  });
});

// ── Multiple violations ───────────────────────────────────────────────────────

describe('checkTransferCompliance — multiple violations', () => {
  it('reports all violations at once', () => {
    const result = check(
      { active: false, recalled: true, recallReason: 'Safety issue' },
      NEW_OWNER,
      null,
    );
    expect(result.allowed).toBe(false);
    const codes = result.blockers.map((v) => v.code);
    expect(codes).toContain('WALLET_NOT_CONNECTED');
    expect(codes).toContain('PRODUCT_INACTIVE');
    expect(codes).toContain('PRODUCT_RECALLED');
  });

  it('separates blockers from warnings', () => {
    const result = check({ active: false });
    expect(result.blockers.every((v) => v.blocking)).toBe(true);
    expect(result.warnings.every((v) => !v.blocking)).toBe(true);
  });

  it('violations array is the union of blockers and warnings', () => {
    const result = check({ active: false });
    expect(result.violations.length).toBe(result.blockers.length + result.warnings.length);
  });
});

// ── Case insensitivity ────────────────────────────────────────────────────────

describe('checkTransferCompliance — case insensitivity', () => {
  it('blocks same-owner check regardless of case', () => {
    const result = check({}, BASE_PRODUCT.owner.toLowerCase());
    expect(result.blockers.find((b) => b.code === 'SAME_OWNER')).toBeDefined();
  });
});
