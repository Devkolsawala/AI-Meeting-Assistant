import { NextResponse } from "next/server";
import {
  mapSubscriptionStatus,
  planForStatus,
  razorpayConfig,
  verifyWebhookSignature,
} from "../../../lib/billing";
import { processSubscriptionEvent } from "../../../lib/supabase-server";
import { captureError, captureEvent } from "../../../lib/telemetry";

// POST /api/razorpay/webhook — the ONLY place subscription status is written.
// Razorpay signs each delivery; we verify it, then apply the event through an
// atomic RPC that is idempotent (duplicate event ids are no-ops) and out-of-order
// safe. A paid plan written here automatically raises the caps enforced in apps/api.

export const dynamic = "force-dynamic";

interface SubscriptionEntity {
  id?: string;
  status?: string;
  current_end?: number | null;
  customer_id?: string | null;
  notes?: { user_id?: string } | null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  let config;
  try {
    config = razorpayConfig();
  } catch {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Razorpay's per-delivery event id is the idempotency key.
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  let body: {
    event?: string;
    created_at?: number;
    payload?: { subscription?: { entity?: SubscriptionEntity } };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = body.event ?? "unknown";
  const entity = body.payload?.subscription?.entity;

  // Only subscription lifecycle events drive plan state. Acknowledge the rest so
  // Razorpay stops retrying them.
  if (!entity) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  const userId = entity.notes?.user_id;
  if (!userId) {
    // Can't map to a user; acknowledge so Razorpay doesn't retry forever.
    console.error(`[razorpay-webhook] ${eventType} has no notes.user_id (sub ${entity.id ?? "?"})`);
    return NextResponse.json({ ok: true, ignored: "no_user_id" });
  }

  const status = mapSubscriptionStatus(entity.status);
  const plan = planForStatus(status, config.planName);

  try {
    const applied = await processSubscriptionEvent({
      eventId,
      eventType,
      payload: body,
      userId,
      status,
      plan,
      provider: "razorpay",
      providerCustomerId: entity.customer_id ?? null,
      providerSubscriptionId: entity.id ?? null,
      currentPeriodEnd: isoFromUnix(entity.current_end),
      eventAt: isoFromUnix(body.created_at) ?? new Date().toISOString(),
    });
    // Emit the "upgrade" product event when this delivery actually unlocked a plan.
    if (applied && status === "active") {
      captureEvent("upgrade", userId, { plan, provider: "razorpay" });
    }
    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    // Return 500 so Razorpay retries — the RPC is idempotent, so a retry is safe.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[razorpay-webhook] ${eventType}: ${message}`);
    captureError(err, { route: "razorpay-webhook", event: eventType });
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
