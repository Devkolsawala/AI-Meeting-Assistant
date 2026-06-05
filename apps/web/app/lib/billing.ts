import crypto from "node:crypto";

// Razorpay billing helpers (server-only). We call Razorpay's REST API with fetch
// and verify webhook signatures with node:crypto — no SDK dependency. None of
// these values ever reach the browser except the public key id, which the
// checkout route returns explicitly.

const RAZORPAY_API = "https://api.razorpay.com/v1";

/** Subscription statuses allowed by the subscriptions table check constraint. */
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  planId: string;
  planName: string;
  totalCount: number;
}

class BillingConfigError extends Error {}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new BillingConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Reads and validates the Razorpay configuration from the environment. */
export function razorpayConfig(): RazorpayConfig {
  return {
    keyId: requireEnv("RAZORPAY_KEY_ID"),
    keySecret: requireEnv("RAZORPAY_KEY_SECRET"),
    webhookSecret: requireEnv("RAZORPAY_WEBHOOK_SECRET"),
    planId: requireEnv("RAZORPAY_PLAN_ID"),
    planName: process.env.RAZORPAY_PLAN_NAME?.trim() || "pro",
    totalCount: Number.parseInt(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT ?? "", 10) || 120,
  };
}

function basicAuth(cfg: RazorpayConfig): string {
  return Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64");
}

/**
 * Creates a Razorpay subscription for the given user and returns its id. The user
 * id is stored in `notes` so the webhook can map the subscription back to the user.
 * This does NOT write our subscriptions table — only the webhook does that.
 */
export async function createSubscription(
  cfg: RazorpayConfig,
  user: { id: string; email: string | null },
): Promise<string> {
  const res = await fetch(`${RAZORPAY_API}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(cfg)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: cfg.planId,
      total_count: cfg.totalCount,
      customer_notify: 1,
      notes: { user_id: user.id, email: user.email ?? "" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay subscription create failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Razorpay subscription create returned no id");
  }
  return data.id;
}

/**
 * Returns the Razorpay-hosted subscription page for a subscription id, which is
 * the closest thing Razorpay offers to a customer billing portal (view status,
 * mandate, and — depending on settings — cancel). Returns null if unavailable.
 */
export async function getSubscriptionPortalUrl(
  cfg: RazorpayConfig,
  subscriptionId: string,
): Promise<string | null> {
  const res = await fetch(`${RAZORPAY_API}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Basic ${basicAuth(cfg)}` },
  });
  if (!res.ok) {
    throw new Error(`Razorpay subscription fetch failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { short_url?: string };
  return data.short_url ?? null;
}

/** Verifies a Razorpay webhook signature (HMAC-SHA256 of the raw body). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!signature) {
    return false;
  }
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Maps a Razorpay subscription status to our subscriptions.status enum. */
export function mapSubscriptionStatus(razorpayStatus: string | undefined): SubscriptionStatus {
  switch (razorpayStatus) {
    case "active":
    case "resumed":
      return "active";
    case "authenticated":
      return "trialing";
    case "pending":
    case "halted":
    case "paused":
      return "past_due";
    case "cancelled":
    case "completed":
    case "expired":
      return "canceled";
    default:
      return "inactive";
  }
}

/** A paid plan unlocks higher caps; a canceled/expired subscription falls to free. */
export function planForStatus(status: SubscriptionStatus, paidPlanName: string): string {
  return status === "active" || status === "trialing" ? paidPlanName : "free";
}
