"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

interface NotifyModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}

/** Lightweight accessible modal: closes on backdrop click, the × button, or Escape. */
export function NotifyModal({
  open,
  onClose,
  title,
  description,
  children,
}: NotifyModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-zinc-900/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-5 w-5">
            <path d="M6.3 5 5 6.3 8.7 10 5 13.7 6.3 15 10 11.3 13.7 15 15 13.7 11.3 10 15 6.3 13.7 5 10 8.7 6.3 5Z" />
          </svg>
        </button>
        <h2 id={titleId} className="pr-8 text-xl font-semibold text-zinc-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
