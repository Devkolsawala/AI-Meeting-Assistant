"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, readSession } from "../components/session";
import { SiteHeader } from "../components/site-header";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Status = "loading" | "ready" | "unauthenticated" | "error";

function planLabel(plan: string): string {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Light gradient page shell shared by every state of this screen. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-100 via-white to-white text-zinc-900">
      <SiteHeader
        action={
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Back to site
          </Link>
        }
      />
      <main className="flex w-full max-w-none flex-1 justify-center px-5 py-14">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

export default function AccountPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  // Default plan is Free: a brand-new user may have no subscriptions row yet.
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setStatus("error");
      return;
    }
    const session = readSession();
    if (!session) {
      setStatus("unauthenticated");
      return;
    }

    let cancelled = false;
    const authHeaders = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
    };

    (async () => {
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
        if (userRes.status === 401) {
          clearSession();
          if (!cancelled) setStatus("unauthenticated");
          return;
        }
        if (!userRes.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const user = (await userRes.json()) as { email?: string | null };

        // Plan is best-effort: never block the page if the lookup fails.
        let resolvedPlan = "free";
        try {
          const subRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=plan`, {
            headers: authHeaders,
          });
          if (subRes.ok) {
            const rows = (await subRes.json()) as Array<{ plan?: string | null }>;
            if (rows[0]?.plan) resolvedPlan = rows[0].plan;
          }
        } catch {
          // Keep the Free default.
        }

        if (cancelled) return;
        setEmail(user.email ?? null);
        setPlan(resolvedPlan);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function signOut() {
    clearSession();
    window.location.href = "/";
  }

  if (status === "loading") {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">Loading your account…</p>
        </div>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Account</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Something went wrong loading your account. Please try signing in again.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            You&apos;re signed out
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in to see your plan and download link.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Sign in
            </Link>
            <a
              href="/download"
              className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              Download the app
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  const initial = (email?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <Shell>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Your account</h1>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>

      {/* Identity + plan */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900">{email ?? "Your account"}</p>
            <p className="text-sm text-zinc-500">Signed in</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5">
          <div>
            <p className="text-sm font-medium text-zinc-700">Plan</p>
            <p className="text-sm text-zinc-500">
              {plan === "free" ? "Upgrade options are coming soon." : "Thanks for subscribing."}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
            {planLabel(plan)}
          </span>
        </div>
      </div>

      {/* Download */}
      <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-zinc-900">Get the desktop app</p>
          <p className="mt-1 text-sm text-zinc-500">
            Install MeetCopilot for Windows and sign in with this account.
          </p>
        </div>
        <a
          href="/download"
          className="shrink-0 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Download the app
        </a>
      </div>

      {/* Phase 2 — usage meter + billing portal. Intentional placeholders;
          metering and billing are server-authoritative and out of scope here. */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {[
          { title: "Usage", body: "Track your monthly answers and transcription minutes." },
          { title: "Billing", body: "Manage your plan, payment method, and invoices." },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-6"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-zinc-900">{card.title}</p>
              <span className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                Phase 2
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">{card.body}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
