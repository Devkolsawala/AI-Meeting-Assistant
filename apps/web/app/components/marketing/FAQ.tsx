"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "How is the overlay invisible during screen share?",
    a: "MeetCopilot sets OS-level window flags — the same technique DRM video players use — that exclude the window from all screen capture pipelines. It never appears in Zoom recordings, Teams, Meet, or OBS.",
  },
  {
    q: "Do I need to add a bot to my meeting?",
    a: "Never. MeetCopilot captures audio directly from your system audio driver. There's no bot account, no meeting invite, and no participant notification.",
  },
  {
    q: "What happens to my audio and transcript data?",
    a: "Audio is streamed to our transcription provider during the call and discarded immediately after. We store only the final transcript and summary, encrypted at rest. Authentication credentials never leave our servers.",
  },
  {
    q: "Which meeting platforms work with MeetCopilot?",
    a: "Any platform that plays audio through your system — Zoom, Teams, Google Meet, Webex, Slack Huddles, Discord, and phone calls. If you can hear it, MeetCopilot can transcribe it.",
  },
  {
    q: "Is this appropriate to use during job interviews?",
    a: "That depends on the rules of the interview. Using it in interviews you're conducting is standard and productive. Using it in interviews where you're the candidate — check the process rules. We trust users to make that call.",
  },
  {
    q: "Which languages are supported?",
    a: "12+ languages including English, Hindi, Spanish, French, German, Portuguese, Mandarin Chinese, Japanese, Korean, Arabic, Dutch, and Italian.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white px-6 py-28">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center font-display text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#0A0A0A]">
          Questions, answered.
        </h2>

        <div className="mt-12">
          {ITEMS.map((item, i) => {
            const expanded = open === i;
            return (
              <div key={item.q} className="border-b border-[var(--color-border)] py-1">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium text-[#0A0A0A]"
                >
                  {item.q}
                  <span
                    className={`shrink-0 text-xl text-[var(--color-text-muted)] transition-transform duration-200 ${
                      expanded ? "rotate-45" : ""
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    expanded ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
