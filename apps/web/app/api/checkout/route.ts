import { NextResponse } from "next/server";
import { createSubscription, razorpayConfig } from "../../lib/billing";
import { verifyAccessToken } from "../../lib/supabase-server";
import { captureError } from "../../lib/telemetry";

// POST /api/checkout — starts a Razorpay subscription checkout for the signed-in
// user. The user id is carried in the subscription's notes so the webhook can map
// it back. This route deliberately does NOT write the subscriptions table — the
// webhook is the only writer of subscription status.

export const dynamic = "force-dynamic";

function bearer(header: string | null): string | null {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) {
    return null;
  }
  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

export async function POST(request: Request) {
  const token = bearer(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });
  }

  const user = await verifyAccessToken(token);
  if (!user) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  let config;
  try {
    config = razorpayConfig();
  } catch {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  try {
    const subscriptionId = await createSubscription(config, user);
    return NextResponse.json({ subscriptionId, keyId: config.keyId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[checkout] ${message}`);
    captureError(err, { route: "checkout" });
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
