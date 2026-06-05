import { NextResponse } from "next/server";
import { getSubscriptionPortalUrl, razorpayConfig } from "../../../lib/billing";
import { readSubscription, verifyAccessToken } from "../../../lib/supabase-server";
import { captureError } from "../../../lib/telemetry";

// POST /api/billing/portal — returns the Razorpay-hosted subscription page for the
// signed-in user so they can manage their plan. Read-only: this route never writes
// subscription state (the webhook is the sole writer).

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
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
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
    const subscription = await readSubscription(user.id);
    if (!subscription || subscription.provider !== "razorpay" || !subscription.providerSubscriptionId) {
      return NextResponse.json({ error: "No active subscription to manage." }, { status: 404 });
    }
    const url = await getSubscriptionPortalUrl(config, subscription.providerSubscriptionId);
    if (!url) {
      return NextResponse.json({ error: "Billing page is unavailable right now." }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[billing-portal] ${message}`);
    captureError(err, { route: "billing-portal" });
    return NextResponse.json({ error: "Could not open billing. Please try again." }, { status: 502 });
  }
}
