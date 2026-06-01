import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/snapshots/[productId]
 *
 * Returns the audit snapshot history for a product (#400).
 */
export async function GET(_req: NextRequest, { params }: { params: { productId: string } }) {
  const { productId } = params;
  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 });
  }

  // In production this calls get_snapshots via Soroban RPC.
  return NextResponse.json({
    productId,
    snapshots: [],
    note: 'Connect to Soroban RPC to retrieve live snapshot data.',
  });
}
