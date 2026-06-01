/**
 * GET  /api/v1/contract/pause  — return current pause state
 * POST /api/v1/contract/pause  — set pause state (guardian only)
 */

import { NextResponse } from 'next/server';

// In production this would read from / write to the Soroban contract via RPC.
// For now we use a module-level variable as a lightweight stand-in that
// survives the process lifetime (suitable for dev/test; replace with KV or
// contract call in production).
let pauseState = {
  paused: false,
  pausedBy: undefined as string | undefined,
  pausedAt: undefined as number | undefined,
  reason: undefined as string | undefined,
};

export async function GET() {
  return NextResponse.json(pauseState);
}

export async function POST(request: Request) {
  let body: { paused?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: '"paused" must be a boolean' }, { status: 400 });
  }

  // TODO: verify caller is an authorized guardian via Soroban auth check.
  pauseState = {
    paused: body.paused,
    pausedBy: 'guardian', // replace with verified caller address
    pausedAt: body.paused ? Math.floor(Date.now() / 1000) : undefined,
    reason: body.reason,
  };

  return NextResponse.json(pauseState);
}
