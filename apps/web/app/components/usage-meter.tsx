"use client";

import { useEffect, useState } from "react";
import { readSession } from "./session";

// Live usage meter for /account. Reads the authoritative usage snapshot from the
// backend (GET /usage), which aggregates usage_sessions and knows the plan caps.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

interface UsageSnapshot {
  plan: string;
  sessions: number;
  sttSeconds: number;
  limits: { maxSessions: number | null; maxSttSeconds: number | null };
  overLimit: boolean;
  warn: boolean;
}

type State =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; usage: UsageSnapshot };

function Bar({ used, cap }: { used: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-blue-600";
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Row({
  label,
  used,
  cap,
  unit,
}: {
  label: string;
  used: number;
  cap: number | null;
  unit: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600">{label}</span>
        <span className="font-medium text-zinc-900">
          {cap === null ? `${used} ${unit} • Unlimited` : `${used} / ${cap} ${unit}`}
        </span>
      </div>
      {cap !== null && <Bar used={used} cap={cap} />}
    </div>
  );
}

export function UsageMeter() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!API_BASE) {
      setState({ kind: "unavailable" });
      return;
    }
    const session = readSession();
    if (!session) {
      setState({ kind: "unavailable" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/usage`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "unavailable" });
          return;
        }
        const usage = (await res.json()) as UsageSnapshot;
        if (!cancelled) setState({ kind: "ready", usage });
      } catch {
        if (!cancelled) setState({ kind: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-zinc-900">Usage</p>
        <span className="text-xs font-medium text-zinc-400">vs your plan limit</span>
      </div>

      {state.kind === "loading" && <p className="mt-3 text-sm text-zinc-500">Loading usage…</p>}

      {state.kind === "unavailable" && (
        <p className="mt-3 text-sm text-zinc-500">Usage will appear here once the backend is reachable.</p>
      )}

      {state.kind === "ready" && (
        <div className="mt-4 flex flex-col gap-4">
          <Row
            label="Sessions"
            used={state.usage.sessions}
            cap={state.usage.limits.maxSessions}
            unit="sessions"
          />
          <Row
            label="Transcription"
            used={Math.round(state.usage.sttSeconds / 60)}
            cap={
              state.usage.limits.maxSttSeconds === null
                ? null
                : Math.round(state.usage.limits.maxSttSeconds / 60)
            }
            unit="min"
          />
          {state.usage.overLimit && (
            <p className="text-sm font-medium text-red-600">
              You&apos;ve reached your plan limit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
