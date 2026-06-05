"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EyeOffIcon, MicIcon, ZapIcon } from "./icons";

const STEPS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <MicIcon className="h-6 w-6 text-accent" />,
    title: "Capture both sides",
    body: "MeetCopilot reads the meeting audio and your microphone as two clean, separate channels. It always knows who said what.",
  },
  {
    icon: <ZapIcon className="h-5 w-5 text-accent" />,
    title: "Ask anything, live",
    body: "Press Ctrl + Enter and the AI streams an answer grounded in exactly what was just said on the call.",
  },
  {
    icon: <EyeOffIcon className="h-6 w-6 text-accent" />,
    title: "Stay invisible",
    body: "The overlay floats above your meeting and disappears during screen share. When you're done, a clean summary waits.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-[var(--color-bg)] px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            How it works
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#0A0A0A]">
            A real-time loop. Three steps.
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-card transition-shadow duration-300 hover:shadow-card-hover"
            >
              <span className="pointer-events-none absolute right-4 top-2 select-none text-[120px] font-bold leading-none text-[#0A0A0A]/[0.04]">
                {i + 1}
              </span>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light">
                {step.icon}
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-[#0A0A0A]">{step.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
