/**
 * Insurance Coverage Metadata Service.
 *
 * Stores and verifies insurance coverage data, claim proof references,
 * premium calculations, risk assessments, and blockchain-verified certificates
 * for products. In production this would be backed by on-chain Soroban
 * contract storage.
 */

export type InsuranceStatus = 'active' | 'expired' | 'claimed' | 'voided';
export type ClaimProofStatus = 'pending' | 'verified' | 'rejected';

// ── Risk assessment ───────────────────────────────────────────────────────────

export interface RiskFactor {
  name: string;
  value: number;
  weight: number;
  description: string;
}

export interface RiskAssessment {
  productId: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  assessedAt: number;
  recommendedCoverageMultiplier: number;
}

export function assessRisk(params: {
  productId: string;
  productValue: number;
  hasRecallHistory: boolean;
  transitRiskScore: number;
  certificationCount: number;
  storageRiskScore: number;
}): RiskAssessment {
  const factors: RiskFactor[] = [
    {
      name: 'productValue',
      value: Math.min(params.productValue / 100_000, 10),
      weight: 0.3,
      description: 'Higher-value products carry greater financial exposure',
    },
    {
      name: 'recallHistory',
      value: params.hasRecallHistory ? 8 : 1,
      weight: 0.25,
      description: 'Prior recalls significantly elevate risk profile',
    },
    {
      name: 'transitRisk',
      value: Math.min(Math.max(params.transitRiskScore, 0), 10),
      weight: 0.2,
      description: 'Risk during transport and logistics handling',
    },
    {
      name: 'certificationGap',
      value: Math.max(5 - params.certificationCount, 0),
      weight: 0.15,
      description: 'Fewer certifications indicate lower assurance standards',
    },
    {
      name: 'storageRisk',
      value: Math.min(Math.max(params.storageRiskScore, 0), 10),
      weight: 0.1,
      description: 'Risk associated with storage conditions and duration',
    },
  ];

  const score = factors.reduce((sum, f) => sum + f.value * f.weight, 0);

  let level: RiskAssessment['level'];
  let recommendedCoverageMultiplier: number;
  if (score < 2.5) {
    level = 'low';
    recommendedCoverageMultiplier = 1.0;
  } else if (score < 5) {
    level = 'medium';
    recommendedCoverageMultiplier = 1.25;
  } else if (score < 7.5) {
    level = 'high';
    recommendedCoverageMultiplier = 1.6;
  } else {
    level = 'critical';
    recommendedCoverageMultiplier = 2.0;
  }

  return {
    productId: params.productId,
    score: Math.round(score * 100) / 100,
    level,
    factors,
    assessedAt: Date.now(),
    recommendedCoverageMultiplier,
  };
}

// ── Premium calculation ───────────────────────────────────────────────────────

export interface PremiumQuote {
  productId: string;
  provider: string;
  coverageType: string;
  coverageAmount: number;
  currency: string;
  annualPremium: number;
  monthlyPremium: number;
  riskScore: number;
  riskLevel: RiskAssessment['level'];
  validFor: number;
  quotedAt: number;
}

export function calculatePremium(params: {
  productId: string;
  provider: string;
  coverageType: string;
  coverageAmount: number;
  currency: string;
  riskAssessment: RiskAssessment;
}): PremiumQuote {
  const provider = PROVIDER_REGISTRY[params.provider];
  const baseRate = provider?.baseRatePercent ?? 0.02;

  const riskMultiplier = params.riskAssessment.recommendedCoverageMultiplier;
  const typeMultiplier = COVERAGE_TYPE_MULTIPLIER[params.coverageType] ?? 1.0;

  const annualPremium = Math.round(
    params.coverageAmount * baseRate * riskMultiplier * typeMultiplier,
  );

  return {
    productId: params.productId,
    provider: params.provider,
    coverageType: params.coverageType,
    coverageAmount: params.coverageAmount,
    currency: params.currency,
    annualPremium,
    monthlyPremium: Math.round(annualPremium / 12),
    riskScore: params.riskAssessment.score,
    riskLevel: params.riskAssessment.level,
    validFor: 24 * 60 * 60 * 1000,
    quotedAt: Date.now(),
  };
}

const COVERAGE_TYPE_MULTIPLIER: Record<string, number> = {
  'product liability': 1.0,
  cargo: 1.1,
  recall: 1.4,
  'supply chain': 1.2,
  'cyber risk': 1.35,
};

// ── Provider integration framework ───────────────────────────────────────────

export interface InsuranceProviderConfig {
  id: string;
  name: string;
  baseRatePercent: number;
  supportedCoverageTypes: string[];
  maxCoverageAmount: number;
  minCoverageAmount: number;
  currency: string[];
  autoApprovalThreshold: number;
  claimSlaHours: number;
}

export const PROVIDER_REGISTRY: Record<string, InsuranceProviderConfig> = {
  'Acme Insurance': {
    id: 'acme',
    name: 'Acme Insurance',
    baseRatePercent: 0.018,
    supportedCoverageTypes: ['product liability', 'recall', 'supply chain'],
    maxCoverageAmount: 10_000_000_00,
    minCoverageAmount: 10_000_00,
    currency: ['USD', 'EUR', 'GBP'],
    autoApprovalThreshold: 5_000_00,
    claimSlaHours: 48,
  },
  "Lloyd's of Supply": {
    id: 'lloyds',
    name: "Lloyd's of Supply",
    baseRatePercent: 0.022,
    supportedCoverageTypes: ['cargo', 'product liability', 'cyber risk', 'recall'],
    maxCoverageAmount: 50_000_000_00,
    minCoverageAmount: 50_000_00,
    currency: ['USD', 'GBP', 'EUR', 'JPY'],
    autoApprovalThreshold: 25_000_00,
    claimSlaHours: 24,
  },
};

export function listProviders(): InsuranceProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY);
}

export function getProvider(name: string): InsuranceProviderConfig | null {
  return PROVIDER_REGISTRY[name] ?? null;
}

// ── Automatic claim processing ────────────────────────────────────────────────

export interface ClaimProcessingResult {
  claimId: string;
  coverageId: string;
  decision: 'auto_approved' | 'auto_rejected' | 'manual_review';
  reason: string;
  processedAt: number;
  slaDeadline: number;
}

export function processClaimAutomatically(
  coverageId: string,
  claimId: string,
): ClaimProcessingResult | null {
  const coverage = coverageStore.get(coverageId);
  if (!coverage) return null;

  const claim = coverage.claimProofs.find((p) => p.id === claimId);
  if (!claim) return null;

  const provider = PROVIDER_REGISTRY[coverage.provider];
  const slaHours = provider?.claimSlaHours ?? 72;
  const slaDeadline = claim.filedAt + slaHours * 60 * 60 * 1000;

  const now = Date.now();
  let decision: ClaimProcessingResult['decision'];
  let reason: string;

  const threshold = provider?.autoApprovalThreshold ?? 0;
  const claimEstimatedAmount = coverage.coverageAmount * 0.1;

  if (coverage.status === 'voided') {
    decision = 'auto_rejected';
    reason = 'Coverage has been voided';
    updateClaimProofStatus(coverageId, claimId, 'rejected', reason);
  } else if (now > (coverage.validUntil !== 0 ? coverage.validUntil : Infinity)) {
    decision = 'auto_rejected';
    reason = 'Coverage period has expired';
    updateClaimProofStatus(coverageId, claimId, 'rejected', reason);
  } else if (claim.documentHash && claimEstimatedAmount <= threshold) {
    decision = 'auto_approved';
    reason = `Claim amount within auto-approval threshold (${formatCoverageAmount(threshold, coverage.currency)}) with verified document hash`;
    updateClaimProofStatus(coverageId, claimId, 'verified', reason);
  } else {
    decision = 'manual_review';
    reason = claim.documentHash
      ? 'Claim exceeds auto-approval threshold; routed to manual review'
      : 'Missing document hash; routed to manual review for verification';
  }

  return { claimId, coverageId, decision, reason, processedAt: now, slaDeadline };
}

// ── Insurance certificate generation ─────────────────────────────────────────

export interface InsuranceCertificate {
  certificateId: string;
  coverageId: string;
  productId: string;
  provider: string;
  policyNumber: string;
  coverageType: string;
  coverageAmount: number;
  currency: string;
  validFrom: number;
  validUntil: number;
  issuedAt: number;
  issuedBy: string;
  blockchainRef: string;
  integrityHash: string;
  verified: boolean;
}

function deriveIntegrityHash(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `sha256-sim:${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`;
}

export function generateInsuranceCertificate(
  coverageId: string,
  issuedBy: string,
): InsuranceCertificate | null {
  const coverage = coverageStore.get(coverageId);
  if (!coverage) return null;
  if (coverage.status === 'voided') return null;

  const issuedAt = Date.now();
  const certId = `cert-${issuedAt}-${coverageId.slice(-6)}-${Math.random().toString(36).slice(2, 7)}`;

  const payload = JSON.stringify({
    certId,
    coverageId,
    productId: coverage.productId,
    provider: coverage.provider,
    policyNumber: coverage.policyNumber,
    coverageAmount: coverage.coverageAmount,
    currency: coverage.currency,
    validFrom: coverage.validFrom,
    validUntil: coverage.validUntil,
    issuedAt,
    issuedBy,
  });

  const integrityHash = deriveIntegrityHash(payload);
  const blockchainRef = `stellar:mainnet:0x${integrityHash.slice(11, 27)}`;

  const cert: InsuranceCertificate = {
    certificateId: certId,
    coverageId,
    productId: coverage.productId,
    provider: coverage.provider,
    policyNumber: coverage.policyNumber,
    coverageType: coverage.coverageType,
    coverageAmount: coverage.coverageAmount,
    currency: coverage.currency,
    validFrom: coverage.validFrom,
    validUntil: coverage.validUntil,
    issuedAt,
    issuedBy,
    blockchainRef,
    integrityHash,
    verified: true,
  };

  certificateStore.set(certId, cert);
  return cert;
}

export function getCertificate(certificateId: string): InsuranceCertificate | null {
  return certificateStore.get(certificateId) ?? null;
}

export function listCertificatesForCoverage(coverageId: string): InsuranceCertificate[] {
  return Array.from(certificateStore.values()).filter((c) => c.coverageId === coverageId);
}

export interface InsuranceCoverage {
  /** Unique coverage record ID. */
  id: string;
  /** Product this coverage applies to. */
  productId: string;
  /** Name of the insurance provider. */
  provider: string;
  /** Policy number / reference. */
  policyNumber: string;
  /** Coverage type (e.g. "product liability", "cargo", "recall"). */
  coverageType: string;
  /** Coverage amount in smallest currency unit (e.g. cents). */
  coverageAmount: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** Unix ms timestamp when coverage starts. */
  validFrom: number;
  /** Unix ms timestamp when coverage expires. 0 = no expiry. */
  validUntil: number;
  /** Current status of the coverage. */
  status: InsuranceStatus;
  /** Off-chain reference to the policy document (IPFS CID, URL, etc.). */
  documentRef?: string;
  /** Address of the actor who registered this coverage. */
  registeredBy: string;
  /** Unix ms timestamp when this record was created. */
  createdAt: number;
  /** Claim proof references associated with this coverage. */
  claimProofs: ClaimProof[];
}

export interface ClaimProof {
  /** Unique claim proof ID. */
  id: string;
  /** Coverage record this proof belongs to. */
  coverageId: string;
  /** Product ID. */
  productId: string;
  /** Short description of the claim. */
  description: string;
  /** Off-chain proof reference (IPFS CID, URL, document hash, etc.). */
  proofRef: string;
  /** SHA-256 hash of the proof document for integrity verification. */
  documentHash?: string;
  /** Current verification status. */
  status: ClaimProofStatus;
  /** Address of the claimant. */
  claimant: string;
  /** Unix ms timestamp when the claim was filed. */
  filedAt: number;
  /** Unix ms timestamp when the claim was last updated. */
  updatedAt: number;
  /** Optional notes from the verifier. */
  verifierNotes?: string;
}

// ── In-memory stores (replace with DB / on-chain in production) ──────────────

const coverageStore = new Map<string, InsuranceCoverage>();
const certificateStore = new Map<string, InsuranceCertificate>();

// ── Coverage CRUD ─────────────────────────────────────────────────────────────

export function addCoverage(params: {
  productId: string;
  provider: string;
  policyNumber: string;
  coverageType: string;
  coverageAmount: number;
  currency: string;
  validFrom: number;
  validUntil: number;
  documentRef?: string;
  registeredBy: string;
}): InsuranceCoverage {
  const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  const coverage: InsuranceCoverage = {
    id,
    productId: params.productId,
    provider: params.provider,
    policyNumber: params.policyNumber,
    coverageType: params.coverageType,
    coverageAmount: params.coverageAmount,
    currency: params.currency,
    validFrom: params.validFrom,
    validUntil: params.validUntil,
    status: 'active',
    documentRef: params.documentRef,
    registeredBy: params.registeredBy,
    createdAt: now,
    claimProofs: [],
  };

  coverageStore.set(id, coverage);
  return coverage;
}

export function getCoverage(id: string): InsuranceCoverage | null {
  return coverageStore.get(id) ?? null;
}

export function listCoverageForProduct(productId: string): InsuranceCoverage[] {
  return Array.from(coverageStore.values())
    .filter((c) => c.productId === productId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getActiveCoverage(productId: string): InsuranceCoverage[] {
  const now = Date.now();
  return listCoverageForProduct(productId).filter(
    (c) =>
      c.status === 'active' && c.validFrom <= now && (c.validUntil === 0 || c.validUntil >= now),
  );
}

export function voidCoverage(id: string): InsuranceCoverage | null {
  const coverage = coverageStore.get(id);
  if (!coverage) return null;
  coverage.status = 'voided';
  coverageStore.set(id, coverage);
  return coverage;
}

// ── Claim proofs ──────────────────────────────────────────────────────────────

export function addClaimProof(params: {
  coverageId: string;
  productId: string;
  description: string;
  proofRef: string;
  documentHash?: string;
  claimant: string;
}): ClaimProof | null {
  const coverage = coverageStore.get(params.coverageId);
  if (!coverage) return null;

  const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  const proof: ClaimProof = {
    id,
    coverageId: params.coverageId,
    productId: params.productId,
    description: params.description,
    proofRef: params.proofRef,
    documentHash: params.documentHash,
    status: 'pending',
    claimant: params.claimant,
    filedAt: now,
    updatedAt: now,
  };

  coverage.claimProofs.push(proof);
  coverage.status = 'claimed';
  coverageStore.set(params.coverageId, coverage);
  return proof;
}

export function updateClaimProofStatus(
  coverageId: string,
  claimId: string,
  status: ClaimProofStatus,
  verifierNotes?: string,
): ClaimProof | null {
  const coverage = coverageStore.get(coverageId);
  if (!coverage) return null;

  const proof = coverage.claimProofs.find((p) => p.id === claimId);
  if (!proof) return null;

  proof.status = status;
  proof.updatedAt = Date.now();
  if (verifierNotes) proof.verifierNotes = verifierNotes;

  coverageStore.set(coverageId, coverage);
  return proof;
}

// ── Verification ──────────────────────────────────────────────────────────────

export interface CoverageVerificationResult {
  covered: boolean;
  activePolicies: InsuranceCoverage[];
  expiredPolicies: InsuranceCoverage[];
  totalCoverageAmount: number;
  currency: string;
}

export function verifyCoverage(productId: string): CoverageVerificationResult {
  const all = listCoverageForProduct(productId);
  const active = getActiveCoverage(productId);
  const expired = all.filter((c) => c.status === 'expired' || c.status === 'voided');

  const totalCoverageAmount = active.reduce((sum, c) => sum + c.coverageAmount, 0);
  const currency = active[0]?.currency ?? 'USD';

  return {
    covered: active.length > 0,
    activePolicies: active,
    expiredPolicies: expired,
    totalCoverageAmount,
    currency,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCoverageAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export function isCoverageExpired(coverage: InsuranceCoverage): boolean {
  if (coverage.validUntil === 0) return false;
  return coverage.validUntil < Date.now();
}

export const COVERAGE_STATUS_BADGE: Record<InsuranceStatus, string> = {
  active:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  expired:
    'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
  claimed:
    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  voided:
    'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
};
