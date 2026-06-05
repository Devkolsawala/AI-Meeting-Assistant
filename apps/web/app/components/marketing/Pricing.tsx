"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface Tier {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "/forever",
    tagline: "Try it on your next call.",
    features: ["Live AI answers", "Dual-voice transcription", "2 meetings per month"],
  },
  {
    name: "Pro",
    price: "$20",
    cadence: "/month",
    tagline: "For people in meetings all day.",
    features: [
      "Everything in Free",
      "Unlimited meetings",
      "Personas",
      "Post-meeting summaries",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Power",
    price: "$49",
    cadence: "/month",
    tagline: "Maximum headroom.",
    features: [
      "Everything in Pro",
      "Highest usage limits",
      "Priority AI model",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-[var(--color-bg)] px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            Pricing
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#0A0A0A]">
            Simple pricing.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--color-text-secondary)]">
            Start free. Upgrade when MeetCopilot earns a place in your workflow.
          </p>
        </motion.div>

        <div className="mt-14 grid items-start gap-6 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className={`relative rounded-2xl p-8 ${
                tier.featured
                  ? "border-2 border-[var(--color-ink)] bg-[var(--color-ink)]"
                  : "border border-[var(--color-border)] bg-white"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  Most popular
                </span>
              )}
              <h3 className={`font-display text-lg font-semibold ${tier.featured ? "text-white" : "text-[#0A0A0A]"}`}>
                {tier.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-[2.5rem] font-bold leading-none ${tier.featured ? "text-white" : "text-[#0A0A0A]"}`}>
                  {tier.price}
                </span>
                <span className={tier.featured ? "text-sm text-white/50" : "text-sm text-[var(--color-text-muted)]"}>
                  {tier.cadence}
                </span>
              </div>
              <p className={`mt-2 text-sm ${tier.featured ? "text-white/70" : "text-[var(--color-text-secondary)]"}`}>
                {tier.tagline}
              </p>
              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${tier.featured ? "text-white/80" : "text-[var(--color-text-secondary)]"}`}
                  >
                    <span className="mt-0.5 text-accent">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  tier.featured
                    ? "bg-white text-[#0A0A0A] hover:bg-white/90"
                    : "border border-[var(--color-border-strong)] text-[#0A0A0A] hover:bg-[var(--color-surface-subtle)]"
                }`}
              >
                Get started
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
          Final plans and limits are being finalized — pricing shown is indicative.
        </p>
      </div>
    </section>
  );
}
