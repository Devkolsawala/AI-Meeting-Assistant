"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const ANSWER =
  "Start with a token bucket in Redis per API key. Refill at the allowed rate, reject when empty. For distributed setups add a sliding window with INCR + EXPIRE…";

/** Typewriter that reveals ANSWER over ~3s and restarts every 8s. */
function useTypewriter(text: string) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      setShown(text.slice(0, i));
      i += 1;
      if (i <= text.length) {
        timer = setTimeout(step, 28);
      } else {
        timer = setTimeout(() => {
          i = 0;
          step();
        }, 5000);
      }
    };
    step();
    return () => clearTimeout(timer);
  }, [text]);
  return shown;
}

export function ProductMockup() {
  const answer = useTypewriter(ANSWER);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-16 max-w-2xl animate-float overflow-hidden rounded-2xl shadow-product"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[#F8F8F8] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
            MeetCopilot · active
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            ● Hidden on screen share
          </span>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[3fr_2fr]">
          {/* Transcript */}
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Transcript
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3B82F6]" />
                <p className="text-xs leading-relaxed text-[#0A0A0A]">
                  How would you design a distributed rate limiter for our public API?
                </p>
              </div>
              <div className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Good question — I&apos;d start with<span className="animate-pulse">…</span>
                </p>
              </div>
            </div>
          </div>

          {/* AI answer */}
          <div className="rounded-xl bg-accent-light p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-accent">
              Suggested answer
            </p>
            <p className="min-h-[5.5rem] text-xs leading-relaxed text-[#1e1b4b]">
              {answer}
              <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-[#1e1b4b] align-middle" />
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[#F8F8F8] px-4 py-2.5">
          <span className="flex-1 text-xs italic text-[var(--color-text-muted)]">
            Ask anything about this call…
          </span>
          <kbd className="rounded border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
            Ctrl + ↵
          </kbd>
        </div>
      </div>
    </motion.div>
  );
}
