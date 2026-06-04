"use client";

import { type FormEvent, useEffect, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistFormProps {
  /** localStorage key used to remember that this visitor already joined. */
  storageKey?: string;
  /** Message shown after a successful submit. */
  successMessage?: string;
  /** Submit button label. */
  buttonLabel?: string;
}

/**
 * Email capture for "notify me" lists. There is no waitlist backend yet, so the
 * address is validated and remembered locally (so returning visitors see they
 * already joined). Persistence to a real store lands in a later phase.
 */
export function WaitlistForm({
  storageKey = "meetcopilot:macos-waitlist",
  successMessage = "You're on the list — we'll email you when the macOS build is ready.",
  buttonLabel = "Notify me",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(storageKey)) setJoined(true);
  }, [storageKey]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    localStorage.setItem(storageKey, value);
    setError(null);
    setJoined(true);
  }

  if (joined) {
    return (
      <p
        role="status"
        className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        {successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${storageKey}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${storageKey}-email`}
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${storageKey}-error` : undefined}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {buttonLabel}
        </button>
      </div>
      {error && (
        <p id={`${storageKey}-error`} className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
