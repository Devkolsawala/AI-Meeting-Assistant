"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ProductMockup } from "./ProductMockup";

const LINE_ONE = ["Your", "next", "meeting"];

function Word({ children, i, accent, serif }: { children: string; i: number; accent?: boolean; serif?: boolean }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-block ${accent ? "text-accent" : ""} ${serif ? "font-serif italic" : ""}`}
    >
      {children}
      {" "}
    </motion.span>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Gradient mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "var(--gradient-mesh)" }}
      />
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-50 [background-image:radial-gradient(circle,rgba(0,0,0,0.12)_1px,transparent_1px)] [background-size:28px_28px]"
      />
      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-64"
        style={{ background: "linear-gradient(to bottom, transparent 0%, var(--color-bg) 100%)" }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-40 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent"
        >
          ✦ Real-time AI · For every meeting
        </motion.span>

        <h1 className="mt-6 font-display text-[clamp(2.8rem,5.5vw,5rem)] font-bold leading-tight text-[#0A0A0A]">
          <span className="block">
            {LINE_ONE.map((w, i) => (
              <Word key={w} i={i}>
                {w}
              </Word>
            ))}
          </span>
          <span className="block">
            <Word i={3} serif accent>
              deserves
            </Word>
            <Word i={4}>an</Word>
            <Word i={5}>edge.</Word>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]"
        >
          Real-time answers. Post-meeting summaries. An invisible overlay nobody else can see.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <a
            href="/download"
            className="rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-button-brand transition-all hover:bg-accent-hover hover:shadow-lg"
          >
            Download for Windows&nbsp;&nbsp;→
          </a>
          <Link
            href="/login"
            className="rounded-xl border border-[var(--color-border-strong)] bg-white px-6 py-3.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[var(--color-surface-subtle)]"
          >
            Watch 2-min demo&nbsp;&nbsp;▷
          </Link>
        </motion.div>

        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Free · Windows 10+ · macOS coming soon
        </p>

        <ProductMockup />
      </div>
    </section>
  );
}
