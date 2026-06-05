"use client";

import { type FormEvent, useEffect, useState } from "react";
import { DownloadCta } from "../download-cta";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "meetcopilot:macos-waitlist";

const CTA_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#0A0A0A] shadow-lg transition-colors hover:bg-white/90";

function MacWaitlist() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) setJoined(true);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, value);
    setError(null);
    setJoined(true);
  }

  if (joined) {
    return <p className="mt-4 text-sm font-medium text-accent">✓ You&apos;re on the list.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4">
      <label htmlFor="mac-waitlist" className="sr-only">
        Email address
      </label>
      <input
        id="mac-waitlist"
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError(null);
        }}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[var(--color-text-muted)] focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Notify me
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </form>
  );
}

export function DownloadCTA({ installerAvailable }: { installerAvailable: boolean }) {
  return (
    <section id="download" className="scroll-mt-24 bg-[var(--color-bg)] px-6 py-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[var(--color-ink)] px-8 py-16 text-center sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 600px 400px at 0% 0%, rgba(67,56,202,0.20) 0%, transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div className="relative z-10">
          <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent/90">
            Download
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,4.5vw,4rem)] font-bold leading-tight text-white">
            Your next meeting is in 20 minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/60">
            Install MeetCopilot. You&apos;ll never walk in unprepared again.
          </p>
          <div className="mt-8 flex justify-center">
            <DownloadCta
              installerAvailable={installerAvailable}
              label="Download for Windows — It's free"
              className={CTA_BUTTON}
            />
          </div>
          <p className="mt-4 text-xs text-white/25">
            v0.1.0 · Windows 10 build 2004+ · Windows 11 · ~48 MB
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center shadow-card">
        <h3 className="font-display text-base font-semibold text-[#0A0A0A]">On a Mac?</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          We&apos;re building it. First to know when it lands.
        </p>
        <MacWaitlist />
      </div>
    </section>
  );
}
