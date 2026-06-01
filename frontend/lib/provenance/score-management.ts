/**
 * Provenance Score Management Utilities (#507)
 *
 * Provides client-side support for managing and tracking provenance scores
 * across contract upgrades. Scores persist with schema versioning to ensure
 * compatibility across contract versions.
 */

import { SupplyLinkContractClient } from '../stellar/contract-client';

export interface ProvenanceScoreData {
  productId: string;
  score: number;
  lastCalculatedAt: number;
  verifiedEventCount: number;
  schemaVersion: number;
}

/**
 * Calculate provenance score based on event count and verification status.
 *
 * Score formula:
 * - Base: 50 points
 * - +5 points per verified event (max 50 points)
 * - Result: 0-100 range
 *
 * @param verifiedEventCount - Number of verified events
 * @returns Provenance score (0-100)
 */
export function calculateProvenanceScore(verifiedEventCount: number): number {
  const baseScore = 50;
  const eventBonus = Math.min(verifiedEventCount * 5, 50);
  return Math.min(baseScore + eventBonus, 100);
}

/**
 * Set provenance score for a product.
 *
 * @param client - The contract client
 * @param productId - The product ID
 * @param score - The provenance score (0-100)
 * @param verifiedEventCount - Number of verified events
 * @returns The updated score metadata
 */
export async function setProvenanceScore(
  client: SupplyLinkContractClient,
  productId: string,
  score: number,
  verifiedEventCount: number,
): Promise<ProvenanceScoreData> {
  if (score < 0 || score > 100) {
    throw new Error('Provenance score must be between 0 and 100');
  }

  try {
    const result = await client.set_provenance_score({
      product_id: productId,
      score,
      verified_event_count: verifiedEventCount,
    });

    return {
      productId: result.product_id,
      score: result.score,
      lastCalculatedAt: result.last_calculated_at,
      verifiedEventCount: result.verified_event_count,
      schemaVersion: result.schema_version,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('product not found')) {
      throw new Error(`Product ${productId} not found`);
    }
    throw error;
  }
}

/**
 * Get current provenance score for a product.
 *
 * @param client - The contract client
 * @param productId - The product ID
 * @returns The score metadata, or null if not set
 */
export async function getProvenanceScore(
  client: SupplyLinkContractClient,
  productId: string,
): Promise<ProvenanceScoreData | null> {
  try {
    const result = await client.get_provenance_score({ product_id: productId });

    if (!result) {
      return null;
    }

    return {
      productId: result.product_id,
      score: result.score,
      lastCalculatedAt: result.last_calculated_at,
      verifiedEventCount: result.verified_event_count,
      schemaVersion: result.schema_version,
    };
  } catch (error) {
    console.warn(`Failed to get provenance score for ${productId}:`, error);
    return null;
  }
}

/**
 * Get provenance score history for a product.
 *
 * @param client - The contract client
 * @param productId - The product ID
 * @returns Array of historical score entries
 */
export async function getProvenanceScoreHistory(
  client: SupplyLinkContractClient,
  productId: string,
): Promise<ProvenanceScoreData[]> {
  try {
    const results = await client.get_provenance_score_history({
      product_id: productId,
    });

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((result: any) => ({
      productId: result.product_id,
      score: result.score,
      lastCalculatedAt: result.last_calculated_at,
      verifiedEventCount: result.verified_event_count,
      schemaVersion: result.schema_version,
    }));
  } catch (error) {
    console.warn(`Failed to get provenance score history for ${productId}:`, error);
    return [];
  }
}

/**
 * Update provenance score based on new event count.
 *
 * @param client - The contract client
 * @param productId - The product ID
 * @param verifiedEventCount - Updated verified event count
 * @returns The updated score metadata
 */
export async function updateProvenanceScore(
  client: SupplyLinkContractClient,
  productId: string,
  verifiedEventCount: number,
): Promise<ProvenanceScoreData> {
  const newScore = calculateProvenanceScore(verifiedEventCount);
  return setProvenanceScore(client, productId, newScore, verifiedEventCount);
}

/**
 * Get score interpretation (human-readable description).
 *
 * @param score - The provenance score (0-100)
 * @returns Human-readable score interpretation
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Very Poor';
}

/**
 * Get score color for UI display.
 *
 * @param score - The provenance score (0-100)
 * @returns CSS color class or hex value
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // green
  if (score >= 75) return '#3b82f6'; // blue
  if (score >= 60) return '#f59e0b'; // amber
  if (score >= 40) return '#ef4444'; // red
  return '#7f1d1d'; // dark red
}

/**
 * Verify score consistency across contract upgrades.
 *
 * @param client - The contract client
 * @param productId - The product ID
 * @param expectedSchemaVersion - Expected schema version
 * @returns true if score is consistent, false otherwise
 */
export async function verifyScoreConsistency(
  client: SupplyLinkContractClient,
  productId: string,
  expectedSchemaVersion: number,
): Promise<boolean> {
  const score = await getProvenanceScore(client, productId);

  if (!score) {
    return true; // No score to verify
  }

  // Check schema version matches
  if (score.schemaVersion !== expectedSchemaVersion) {
    console.warn(
      `Score schema version mismatch for ${productId}: expected ${expectedSchemaVersion}, got ${score.schemaVersion}`,
    );
    return false;
  }

  // Verify score is in valid range
  if (score.score < 0 || score.score > 100) {
    console.warn(`Invalid score for ${productId}: ${score.score}`);
    return false;
  }

  return true;
}
