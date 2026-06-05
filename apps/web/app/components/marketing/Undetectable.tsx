"use client";

import { motion } from "framer-motion";

const PLATFORMS = ["Zoom", "Slack", "Microsoft Teams", "Google Meet", "Webex", "Discord"];

const CARDS = [
  {
    title: "Doesn't join meetings.",
    body: "There is no bot account, no guest invite, and no notification to other participants.",
    visual: (
      <div className="flex items-center justify-center gap-1.5">
        {["AK", "MR", "JL", "PN"].map((initials, i) => (
          <span
            key={initials}
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[10px] font-semibold text-[var(--color-text-secondary)]"
            style={{ marginLeft: i === 0 ? 0 : -6 }}
          >
            {initials}
          </span>
        ))}
        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
          No bots detected ✓
        </span>
      </div>
    ),
  },
  {
    title: "Invisible to screen share.",
    body: "Your AI answers never appear in recordings, shared screens, or external tools.",
    visual: (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[var(--color-ink)] p-3 text-center text-[10px] text-white/40">
          Shared screen
        </div>
        <div className="rounded-lg bg-accent-light p-3 text-center text-[10px] text-accent">
          Your overlay
        </div>
      </div>
    ),
  },
  {
    title: "Follows your eyes.",
    body: "Drag it anywhere. Keyboard shortcuts reposition it without touching the mouse.",
    visual: (
      <div className="relative h-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        <span className="absolute left-2 top-2 h-5 w-10 animate-float rounded bg-accent/80" />
      </div>
    ),
  },
];

export function Undetectable() {
  return (
    <section className="bg-[var(--color-bg)] px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            Invisibility suite
          </span>
          <h2 className="mt-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[1.05] text-[#0A0A0A]">
            No bot.
            <br />
            No recording.
            <br />
            <span className="text-accent">No trace.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--color-text-secondary)]">
            MeetCopilot works from your machine. It never joins your meeting.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl bg-white p-8 text-center shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="mb-6 flex min-h-[4rem] items-center justify-center">{card.visual}</div>
              <h3 className="font-display text-lg font-semibold text-[#0A0A0A]">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Works alongside every tool you already use
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((p) => (
              <span key={p} className="text-sm font-medium text-[var(--color-text-muted)]">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
