/**
 * Mock data for auditor registry and attestations.
 * Replace with real Soroban contract calls when the contract is deployed.
 */

import type { Auditor, Attestation, BatchWithRecall } from '@/lib/types';

// ── Mock auditors ─────────────────────────────────────────────────────────────

export const MOCK_AUDITORS: Auditor[] = [
  {
    address: 'GAUDITOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    name: 'GlobalTrace Auditing Corp',
    active: true,
    registeredAt: 1709000000,
  },
  {
    address: 'GAUDITOR2ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    name: 'FairChain Certification Ltd',
    active: true,
    registeredAt: 1709100000,
  },
  {
    address: 'GAUDITOR3ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    name: 'SafeSupply Inspections Inc',
    active: false,
    registeredAt: 1708000000,
  },
];

// ── Mock attestations ─────────────────────────────────────────────────────────

export const MOCK_ATTESTATIONS: Attestation[] = [
  // Product-level attestations for prod-001
  {
    id: 'att-001-quality',
    productId: 'prod-001',
    targetId: '',
    auditor: 'GAUDITOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    attestationType: 'quality_check',
    signature: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    timestamp: 1710050000,
    notes: 'Product meets all quality standards. Moisture content within acceptable range.',
  },
  {
    id: 'att-001-origin',
    productId: 'prod-001',
    targetId: '',
    auditor: 'GAUDITOR2ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    attestationType: 'origin_verified',
    signature: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    timestamp: 1710060000,
    notes: 'Origin verified via GPS coordinates and farm registry cross-check.',
  },
  // Event-level attestation for prod-001 HARVEST event
  {
    id: 'att-001-harvest-compliance',
    productId: 'prod-001',
    targetId: 'harvest-stable-id-abc123',
    auditor: 'GAUDITOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    attestationType: 'compliance_verified',
    signature: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    timestamp: 1710010000,
    notes: 'Harvest event complies with fair trade standards.',
  },
  // Product-level attestation for prod-002
  {
    id: 'att-002-safety',
    productId: 'prod-002',
    targetId: '',
    auditor: 'GAUDITOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    attestationType: 'safety_approved',
    signature: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    timestamp: 1711050000,
    notes: 'No contaminants detected. Safety standards met.',
  },
];

// ── Mock batches with recall ───────────────────────────────────────────────────

export const MOCK_BATCHES: BatchWithRecall[] = [
  {
    id: 'batch-2024-001',
    name: 'Ethiopia Coffee Batch Q1 2024',
    owner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    productIds: ['prod-001'],
    timestamp: 1709900000,
    recalled: false,
    recallReason: '',
    recallTimestamp: 0,
  },
  {
    id: 'batch-2024-002',
    name: 'Ghana Cocoa Batch Q1 2024',
    owner: 'GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    productIds: ['prod-002'],
    timestamp: 1710900000,
    recalled: true,
    recallReason: 'Pesticide residue detected above permitted levels',
    recallTimestamp: 1711500000,
  },
];

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getAuditorByAddress(address: string): Auditor | undefined {
  return MOCK_AUDITORS.find((a) => a.address === address);
}

export function getAttestationsByProductId(productId: string): Attestation[] {
  return MOCK_ATTESTATIONS.filter((a) => a.productId === productId);
}

export function getAttestationsByTargetId(productId: string, targetId: string): Attestation[] {
  return MOCK_ATTESTATIONS.filter(
    (a) => a.productId === productId && a.targetId === targetId,
  );
}

export function getBatchById(id: string): BatchWithRecall | undefined {
  return MOCK_BATCHES.find((b) => b.id === id);
}

export function getBatchesByProductId(productId: string): BatchWithRecall[] {
  return MOCK_BATCHES.filter((b) => b.productIds.includes(productId));
}

export function getAllActiveAuditors(): Auditor[] {
  return MOCK_AUDITORS.filter((a) => a.active);
}
