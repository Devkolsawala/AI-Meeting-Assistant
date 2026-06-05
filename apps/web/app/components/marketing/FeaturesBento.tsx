"use client";

import { motion } from "framer-motion";
import { EyeOffIcon } from "./icons";

function WaveBars({ color, base }: { color: string; base: number }) {
  return (
    <div className="flex items-end gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-2 origin-bottom rounded-sm animate-[waveform_0.9s_ease-in-out_infinite_alternate]"
          style={{ height: "28px", backgroundColor: color, animationDelay: `${base + i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

const PERSONAS = [
  { label: "Interview Mode", className: "bg-indigo-100 text-indigo-700", delay: "0s" },
  { label: "Sales Call", className: "bg-emerald-100 text-emerald-700", delay: "2s" },
  { label: "Standup", className: "bg-amber-100 text-amber-700", delay: "4s" },
];

const SUMMARY_ITEMS = [
  "Send API rate limit doc to Marcus",
  "Revisit pricing proposal by Friday",
  "Schedule follow-up with backend team",
];

function Card({
  children,
  className = "",
  index,
}: {
  children: React.ReactNode;
  className?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-2xl bg-white p-8 shadow-card ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function FeaturesBento() {
  return (
    <section id="features" className="bg-[var(--color-surface-subtle)] px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            Features
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#0A0A0A]">
            Built for the moments that matter.
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {/* Card 1 — Dual-voice */}
          <Card index={0}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xs">
                <span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent">
                  Core feature
                </span>
                <h3 className="mt-3 font-display text-xl font-semibold text-[#0A0A0A]">
                  Dual-voice accuracy.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Two separate audio channels — one for the meeting, one for your mic — so context is
                  never confused.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs font-medium text-[#3B82F6]">Them</span>
                  <WaveBars color="#3B82F6" base={0} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs font-medium text-[#10B981]">You</span>
                  <WaveBars color="#10B981" base={0.4} />
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 — Private overlay */}
          <Card index={1}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
              <EyeOffIcon className="h-6 w-6 text-rose-500" />
            </div>
            <h3 className="font-display text-xl font-semibold text-[#0A0A0A]">
              Invisible to screen share.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              OS-level window exclusion means the overlay never appears in recordings, shared
              screens, or external tools.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-ink)] p-3 text-center text-[10px] text-white/50">
                What others see
              </div>
              <div className="relative rounded-lg border border-accent/30 bg-accent-light p-3 text-center text-[10px] text-accent">
                What you see
                <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          </Card>

          {/* Card 3 — Personas */}
          <Card index={2}>
            <div className="relative mb-5 flex h-10 items-center gap-2">
              {PERSONAS.map((p) => (
                <span
                  key={p.label}
                  className={`absolute rounded-full px-3 py-1 text-xs font-medium animate-[personaCycle_6s_ease-in-out_infinite] ${p.className}`}
                  style={{ animationDelay: p.delay }}
                >
                  {p.label}
                </span>
              ))}
            </div>
            <h3 className="font-display text-xl font-semibold text-[#0A0A0A]">Meeting personas.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Switch how the AI thinks based on context — interview, sales, or standup — without
              changing a setting mid-call.
            </p>
          </Card>

          {/* Card 4 — Summaries */}
          <Card index={3}>
            <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <p className="mb-3 text-xs font-medium text-[var(--color-text-secondary)]">
                Summary · Today, 3:41 PM
              </p>
              <ul className="space-y-2">
                {SUMMARY_ITEMS.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.25, duration: 0.4 }}
                    className="flex items-center gap-2 text-xs text-[#0A0A0A]"
                  >
                    <span className="text-[var(--color-text-muted)]">☐</span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
            <h3 className="font-display text-xl font-semibold text-[#0A0A0A]">
              Post-meeting summaries.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Structured recap and action items from the full labeled transcript, ready before you
              close the laptop.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
