/**
 * Regulator certification issuance and audit workflow (#482).
 *
 * Regulators can issue on-chain provenance certifications for products.
 * Each certification records the issuer authority, certification type,
 * scope, and an immutable audit trail.
 */

export type RegulatorCertStatus = 'active' | 'revoked' | 'expired';

export interface RegulatorCertification {
  id: string;
  productId: string;
  productName: string;
  /** Stellar wallet address of the issuing regulator */
  issuerAddress: string;
  /** Human-readable authority name (e.g. "FDA", "EU Organic Authority") */
  issuerAuthority: string;
  certType: string;
  /** Free-text scope description */
  scope: string;
  status: RegulatorCertStatus;
  issuedAt: number;
  /** Unix ms expiry; 0 = no expiry */
  expiresAt: number;
  /** Ordered audit trail */
  auditTrail: CertAuditEntry[];
  /** Simulated on-chain transaction hash */
  txHash?: string;
}

export interface CertAuditEntry {
  action: 'issued' | 'revoked' | 'renewed';
  actor: string;
  timestamp: number;
  note?: string;
}

export interface IssueCertParams {
  productId: string;
  productName: string;
  issuerAddress: string;
  issuerAuthority: string;
  certType: string;
  scope: string;
  /** Duration in days; 0 = no expiry */
  validityDays?: number;
}

// ── In-memory store (replace with DB / on-chain storage in production) ─────────

const certStore = new Map<string, RegulatorCertification>();

function generateId(): string {
  return `rcert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function simulateTxHash(): string {
  return `0x${Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('')}`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export function issueCertification(params: IssueCertParams): RegulatorCertification {
  const id = generateId();
  const now = Date.now();
  const expiresAt =
    params.validityDays && params.validityDays > 0 ? now + params.validityDays * 86_400_000 : 0;

  const cert: RegulatorCertification = {
    id,
    productId: params.productId,
    productName: params.productName,
    issuerAddress: params.issuerAddress,
    issuerAuthority: params.issuerAuthority,
    certType: params.certType,
    scope: params.scope,
    status: 'active',
    issuedAt: now,
    expiresAt,
    auditTrail: [{ action: 'issued', actor: params.issuerAddress, timestamp: now }],
    txHash: simulateTxHash(),
  };

  certStore.set(id, cert);
  return cert;
}

export function revokeCertification(
  id: string,
  actor: string,
  note?: string,
): RegulatorCertification | null {
  const cert = certStore.get(id);
  if (!cert || cert.status === 'revoked') return null;

  cert.status = 'revoked';
  cert.auditTrail.push({ action: 'revoked', actor, timestamp: Date.now(), note });
  certStore.set(id, cert);
  return cert;
}

export function getCertification(id: string): RegulatorCertification | null {
  return certStore.get(id) ?? null;
}

export function listCertifications(productId?: string): RegulatorCertification[] {
  const all = Array.from(certStore.values());
  return productId ? all.filter((c) => c.productId === productId) : all;
}

export function listByIssuer(issuerAddress: string): RegulatorCertification[] {
  return Array.from(certStore.values()).filter((c) => c.issuerAddress === issuerAddress);
}

/** Resolve effective status (auto-expire based on current time). */
export function effectiveStatus(cert: RegulatorCertification): RegulatorCertStatus {
  if (cert.status === 'revoked') return 'revoked';
  if (cert.expiresAt > 0 && Date.now() > cert.expiresAt) return 'expired';
  return 'active';
}
