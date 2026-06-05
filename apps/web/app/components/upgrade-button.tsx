"use client";

import { useState } from "react";
import { readSession } from "./session";

// Razorpay Checkout is loaded on demand from their CDN. The subscription is created
// server-side (/api/checkout); the actual plan unlock is driven by the webhook, so
// after payment we just tell the user it will update shortly.

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  prefill?: { email?: string };
  theme?: { color?: string };
  handler?: (response: unknown) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load checkout.")));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load checkout."));
    document.body.appendChild(script);
  });
}

export function UpgradeButton({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setMessage(null);
    try {
      const session = readSession();
      if (!session) {
        setMessage("Please sign in again to upgrade.");
        return;
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Could not start checkout. Please try again.");
        return;
      }
      const { subscriptionId, keyId } = (await res.json()) as {
        subscriptionId: string;
        keyId: string;
      };

      await loadRazorpay();
      if (!window.Razorpay) {
        setMessage("Could not load checkout. Please try again.");
        return;
      }
      const checkout = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "MeetCopilot",
        description: "Pro plan",
        prefill: email ? { email } : undefined,
        theme: { color: "#2563eb" },
        handler: () => {
          setMessage("Payment received! Your plan will update shortly — refresh in a moment.");
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-default disabled:opacity-60"
      >
        {busy ? "Starting checkout…" : "Upgrade to Pro"}
      </button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
