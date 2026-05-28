import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/webhooks/recall
 *
 * Stub webhook endpoint for product recall notifications (#393).
 * Accepts a recall event payload, validates it, and logs it.
 * In production this would fan out to registered webhook subscribers.
 */

const RecallPayloadSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  reason: z.string().min(1, "reason is required"),
  timestamp: z.number().int().nonnegative(),
});

export type RecallPayload = z.infer<typeof RecallPayloadSchema>;

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = RecallPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { productId, reason, timestamp } = parsed.data;

  // Log the recall notification (stub — replace with real delivery logic)
  console.log("[recall-webhook]", {
    productId,
    reason,
    timestamp,
    receivedAt: new Date().toISOString(),
  });

  // TODO: fan out to registered webhook subscribers
  // await notifySubscribers({ productId, reason, timestamp });

  return NextResponse.json(
    {
      ok: true,
      message: "Recall notification received",
      productId,
      timestamp,
    },
    { status: 200 }
  );
}
