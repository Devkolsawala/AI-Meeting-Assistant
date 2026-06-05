"use client";

import { motion } from "framer-motion";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatar: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Our technical interview process is completely different now. Real-time context means I stop panicking about gaps and start actually listening. It's like having your sharpest colleague whispering in your ear.",
    name: "Sarah Chen",
    role: "Head of Engineering · Nexlify",
    initials: "SC",
    avatar: "bg-violet-100 text-violet-700",
  },
  {
    quote:
      "I closed three deals in two weeks where I'd normally lose track of what the prospect said ten minutes earlier. MeetCopilot holds the thread so I don't have to.",
    name: "Marcus Okafor",
    role: "VP of Sales · Stratex Capital",
    initials: "MO",
    avatar: "bg-blue-100 text-blue-700",
  },
  {
    quote:
      "Standups went from 40 minutes to 18. The post-meeting summaries are better than anything our PMs would write manually — specific, accurate, with action owners.",
    name: "Priya Nair",
    role: "Product Director · Vantora Health",
    initials: "PN",
    avatar: "bg-rose-100 text-rose-700",
  },
  {
    quote:
      "Used it in a board meeting for the first time. When they asked about burn multiple I had the exact number plus context before I'd even opened a tab. That's the confidence this builds.",
    name: "James Whitmore",
    role: "Founder & CEO · Luminex",
    initials: "JW",
    avatar: "bg-amber-100 text-amber-700",
  },
  {
    quote:
      "I run 8-10 customer calls a day. Before MeetCopilot I was burning an hour after each call writing notes. Now the summary is there by the time I close the window.",
    name: "Anika Reyes",
    role: "Customer Success Lead · Orion AI",
    initials: "AR",
    avatar: "bg-emerald-100 text-emerald-700",
  },
  {
    quote:
      "The dual-channel transcription is what sold me. I've tried four other tools and every one mangled who said what. This one just gets it right.",
    name: "David Park",
    role: "Engineering Manager · Cloudreach",
    initials: "DP",
    avatar: "bg-sky-100 text-sky-700",
  },
];

export function Testimonials() {
  return (
    <section className="bg-[var(--color-surface-subtle)] px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#0A0A0A]"
        >
          What our users say.
        </motion.h2>

        <div className="gap-4 md:columns-3 md:[column-gap:1rem]">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4 break-inside-avoid rounded-2xl bg-white p-6 shadow-card"
            >
              <div className="mb-3 text-sm text-amber-400">★★★★★</div>
              <blockquote className="mb-4 text-sm italic leading-relaxed text-[#0A0A0A]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${t.avatar}`}
                >
                  {t.initials}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[#0A0A0A]">{t.name}</span>
                  <span className="block text-xs text-[var(--color-text-secondary)]">{t.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
