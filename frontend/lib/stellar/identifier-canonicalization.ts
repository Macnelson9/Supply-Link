/**
 * Product Identifier Canonicalization Utilities (#508)
 *
 * Provides client-side support for normalizing and resolving product identifiers
 * across alias variants. Integrates with the smart contract's canonicalization
 * functions to ensure consistent product lookups.
 */

import { SupplyLinkContractClient } from './contract-client';
import { Env } from '@stellar/stellar-sdk';

/**
 * Normalize a product identifier by resolving aliases to canonical IDs.
 *
 * @param client - The contract client
 * @param id - The product ID (canonical or alias)
 * @returns The canonical product ID
 */
export async function normalizeProductId(
  client: SupplyLinkContractClient,
  id: string,
): Promise<string> {
  try {
    const resolved = await client.resolve_product_id({ id });
    return resolved;
  } catch (error) {
    // If resolution fails, assume the ID is canonical
    console.warn(`Failed to resolve product ID ${id}:`, error);
    return id;
  }
}

/**
 * Register an alias for a product ID.
 *
 * @param client - The contract client
 * @param canonicalId - The canonical product ID
 * @param alias - The alias to register
 * @param creator - The creator's address
 * @returns The alias entry
 */
export async function registerProductAlias(
  client: SupplyLinkContractClient,
  canonicalId: string,
  alias: string,
  creator: string,
): Promise<any> {
  try {
    const result = await client.register_product_alias({
      canonical_id: canonicalId,
      alias,
      creator,
    });
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('alias already exists')) {
      throw new Error(`Alias "${alias}" is already registered`);
    }
    throw error;
  }
}

/**
 * Validate that a product ID is canonical (not an alias).
 *
 * @param client - The contract client
 * @param id - The product ID to validate
 * @returns true if the ID is canonical, false if it's an alias
 */
export async function isCanonicalId(
  client: SupplyLinkContractClient,
  id: string,
): Promise<boolean> {
  try {
    const resolved = await client.resolve_product_id({ id });
    return resolved === id;
  } catch {
    // If resolution fails, assume it's canonical
    return true;
  }
}

/**
 * Get all aliases for a canonical product ID.
 *
 * @param client - The contract client
 * @param canonicalId - The canonical product ID
 * @returns Array of alias strings
 */
export async function getProductAliases(
  client: SupplyLinkContractClient,
  canonicalId: string,
): Promise<string[]> {
  try {
    const aliases = await client.get_product_aliases({ canonical_id: canonicalId });
    return aliases || [];
  } catch (error) {
    console.warn(`Failed to get aliases for product ${canonicalId}:`, error);
    return [];
  }
}

/**
 * Normalize multiple product IDs in batch.
 *
 * @param client - The contract client
 * @param ids - Array of product IDs to normalize
 * @returns Array of canonical product IDs
 */
export async function normalizeProductIds(
  client: SupplyLinkContractClient,
  ids: string[],
): Promise<string[]> {
  const normalized = await Promise.all(ids.map((id) => normalizeProductId(client, id)));
  return normalized;
}

/**
 * Deduplicate product IDs by resolving aliases to canonical IDs.
 *
 * @param client - The contract client
 * @param ids - Array of product IDs (may contain duplicates and aliases)
 * @returns Array of unique canonical product IDs
 */
export async function deduplicateProductIds(
  client: SupplyLinkContractClient,
  ids: string[],
): Promise<string[]> {
  const normalized = await normalizeProductIds(client, ids);
  return Array.from(new Set(normalized));
}
