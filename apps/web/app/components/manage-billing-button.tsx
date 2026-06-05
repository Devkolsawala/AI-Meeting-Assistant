"use client";

import { useState } from "react";
import { readSession } from "./session";

// Opens the Razorpay-hosted subscription page (via /api/billing/portal) so a
// subscriber can view and manage their plan.

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function manage() {
    setBusy(true);
    setMessage(null);
    try {
      const session = readSession();
      if (!session) {
        setMessage("Please sign in again.");
        return;
      }
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMessage(data.error ?? "Could not open billing.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
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
        onClick={manage}
        disabled={busy}
        className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
