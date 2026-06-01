/**
 * Event provenance proof generation and verification (#477).
 *
 * Proofs are compact, self-contained payloads that link a sequence of
 * on-chain tracking events to the contract's provenance root hash.
 * External auditors can verify a proof without direct contract access.
 *
 * Proof structure:
 *   - version: schema version for forward compatibility
 *   - productId: the product being audited
 *   - provenanceRoot: hex-encoded SHA-256 root from the contract
 *   - eventHashes: ordered SHA-256 hashes of each event payload
 *   - chainHash: cumulative hash chain over all event hashes
 *   - generatedAt: ISO timestamp
 *   - signature: HMAC-SHA256 over the canonical payload (server-side integrity)
 */

import type { TrackingEvent } from '@/lib/types';

export const PROOF_SCHEMA_VERSION = 1;

export interface ProvenanceProof {
  version: number;
  productId: string;
  /** Hex-encoded on-chain provenance root (from contract get_provenance_root) */
  provenanceRoot: string;
  /** Ordered SHA-256 hashes of each event, hex-encoded */
  eventHashes: string[];
  /** Cumulative hash chain: SHA-256(eventHashes[0] || eventHashes[1] || …) */
  chainHash: string;
  /** Total number of events included */
  eventCount: number;
  generatedAt: string;
  /** HMAC-SHA256 over canonical fields for server-side integrity */
  signature: string;
}

export interface ProofVerificationResult {
  valid: boolean;
  /** Matches the on-chain provenance root */
  rootMatch: boolean;
  /** Internal chain hash is self-consistent */
  chainIntact: boolean;
  /** HMAC signature is valid */
  signatureValid: boolean;
  error?: string;
}

// ── Hashing helpers ───────────────────────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback djb2 (non-cryptographic, dev only)
  let h = 5381;
  for (let i = 0; i < data.length; i++) h = ((h << 5) + h) ^ data.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const keyBuf = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', keyBuf, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Hex(key + data);
}

/** Canonical string for a single event (deterministic, order-stable). */
function canonicalEvent(e: TrackingEvent): string {
  return [e.productId, e.eventType, e.location, e.actor, String(e.timestamp), e.metadata].join('|');
}

function getProofSecret(): string {
  return process.env.PROOF_SIGNING_SECRET ?? 'supply-link-proof-default-secret';
}

// ── Proof generation ──────────────────────────────────────────────────────────

/**
 * Generate a provenance proof for a product's event history.
 *
 * @param productId   The product being audited
 * @param events      Ordered tracking events (oldest first)
 * @param provenanceRoot  Hex-encoded root from the contract (or empty string in dev)
 */
export async function generateProvenanceProof(
  productId: string,
  events: TrackingEvent[],
  provenanceRoot: string,
): Promise<ProvenanceProof> {
  // Hash each event individually
  const eventHashes = await Promise.all(events.map((e) => sha256Hex(canonicalEvent(e))));

  // Build cumulative chain hash
  let chainHash = '';
  for (const h of eventHashes) {
    chainHash = await sha256Hex(chainHash + h);
  }

  const generatedAt = new Date().toISOString();

  // Canonical payload for HMAC
  const canonical = [
    String(PROOF_SCHEMA_VERSION),
    productId,
    provenanceRoot,
    chainHash,
    String(eventHashes.length),
    generatedAt,
  ].join(':');

  const signature = await hmacSha256Hex(getProofSecret(), canonical);

  return {
    version: PROOF_SCHEMA_VERSION,
    productId,
    provenanceRoot,
    eventHashes,
    chainHash,
    eventCount: events.length,
    generatedAt,
    signature,
  };
}

// ── Proof verification ────────────────────────────────────────────────────────

/**
 * Verify a provenance proof.
 *
 * @param proof         The proof to verify
 * @param events        The events the proof was generated from (for chain re-computation)
 * @param onChainRoot   The current on-chain provenance root (from contract)
 */
export async function verifyProvenanceProof(
  proof: ProvenanceProof,
  events: TrackingEvent[],
  onChainRoot: string,
): Promise<ProofVerificationResult> {
  try {
    // 1. Re-compute event hashes and chain
    const recomputedHashes = await Promise.all(events.map((e) => sha256Hex(canonicalEvent(e))));
    let recomputedChain = '';
    for (const h of recomputedHashes) {
      recomputedChain = await sha256Hex(recomputedChain + h);
    }

    const chainIntact =
      recomputedChain === proof.chainHash &&
      recomputedHashes.length === proof.eventHashes.length &&
      recomputedHashes.every((h, i) => h === proof.eventHashes[i]);

    // 2. Check on-chain root match
    const rootMatch = onChainRoot === proof.provenanceRoot;

    // 3. Verify HMAC signature
    const canonical = [
      String(proof.version),
      proof.productId,
      proof.provenanceRoot,
      proof.chainHash,
      String(proof.eventCount),
      proof.generatedAt,
    ].join(':');
    const expectedSig = await hmacSha256Hex(getProofSecret(), canonical);
    const signatureValid = expectedSig === proof.signature;

    return {
      valid: chainIntact && rootMatch && signatureValid,
      rootMatch,
      chainIntact,
      signatureValid,
    };
  } catch (err) {
    return {
      valid: false,
      rootMatch: false,
      chainIntact: false,
      signatureValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Encode a proof as a base64 string for transport. */
export function encodeProof(proof: ProvenanceProof): string {
  return Buffer.from(JSON.stringify(proof), 'utf-8').toString('base64');
}

/** Decode a base64-encoded proof. Returns null on parse failure. */
export function decodeProof(encoded: string): ProvenanceProof | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8')) as ProvenanceProof;
  } catch {
    return null;
  }
}
