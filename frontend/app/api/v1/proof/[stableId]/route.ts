import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/proof/[stableId]
 *
 * Returns the on-chain signer proof for a tracking event (#402).
 * External auditors can use this to validate signatures without full app trust.
 */
export async function GET(_req: NextRequest, { params }: { params: { stableId: string } }) {
  const { stableId } = params;
  if (!stableId) {
    return NextResponse.json({ error: 'stableId required' }, { status: 400 });
  }

  // In production this would call the Soroban RPC directly.
  // For now we return a stub that documents the expected shape.
  return NextResponse.json({
    stableId,
    note: 'Connect to Soroban RPC to retrieve live proof data.',
    fields: ['event_stable_id', 'signer', 'payload_hash', 'timestamp'],
  });
}
