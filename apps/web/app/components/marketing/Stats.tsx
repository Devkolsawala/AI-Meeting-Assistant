"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Stat {
  /** Numeric target for the count-up. */
  to: number;
  /** Rendered with these affixes, e.g. prefix "<", suffix "M+". */
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
}

const STATS: Stat[] = [
  { to: 1.2, suffix: "M+", decimals: 1, label: "Meetings assisted" },
  { to: 300, prefix: "<", suffix: "ms", label: "Response time" },
  { to: 95, suffix: "%", label: "Transcription accuracy" },
  { to: 12, suffix: "+", label: "Languages supported" },
];

function StatItem({ stat, start }: { stat: Stat; start: boolean }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    const controls = animate(0, stat.to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [start, stat.to]);

  return (
    <div className="flex flex-col items-center px-6 text-center">
      <span className="font-display text-[2.8rem] font-bold leading-none text-[#0A0A0A]">
        {stat.prefix}
        {value.toFixed(stat.decimals ?? 0)}
        {stat.suffix}
      </span>
      <span className="mt-2 text-sm text-[var(--color-text-secondary)]">{stat.label}</span>
    </div>
  );
}

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="border-y border-[var(--color-border)] bg-white px-6 py-20">
      <div
        ref={ref}
        className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 divide-[var(--color-border)] md:grid-cols-4 md:divide-x"
      >
        {STATS.map((stat) => (
          <StatItem key={stat.label} stat={stat} start={inView} />
        ))}
      </div>
    </section>
  );
}
