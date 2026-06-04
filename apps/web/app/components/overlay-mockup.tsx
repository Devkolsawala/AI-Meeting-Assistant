/**
 * A lightweight, dependency-free mock of a live call: a meeting window with two
 * participant tiles, with the MeetCopilot floating overlay docked on top. Stands
 * in for a product screenshot; swap in a real image here later without changing
 * the surrounding layout.
 */
export function OverlayMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Meeting window */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-black/5">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-black/5 bg-zinc-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs font-medium text-zinc-400">
            Video call · 2 participants
          </span>
        </div>

        {/* Participant tiles */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-2 sm:gap-3 sm:p-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-sky-200 to-indigo-300">
            <div className="absolute bottom-2 left-2 rounded-md bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white">
              Them
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-emerald-200 to-teal-300">
            <div className="absolute bottom-2 left-2 rounded-md bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white">
              You
            </div>
          </div>
        </div>
      </div>

      {/* Floating MeetCopilot overlay (docked over the call) */}
      <div className="absolute -bottom-6 right-2 w-[19rem] max-w-[82%] sm:-right-6 sm:-bottom-8">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur">
          {/* Overlay title bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-zinc-300">
                MeetCopilot — live
              </span>
            </div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              Hidden on screen share
            </span>
          </div>

          {/* Transcript line */}
          <div className="px-4 py-3">
            <div className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 rounded-md bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Them
              </span>
              <p className="text-sm leading-relaxed text-zinc-300">
                How would you design a rate limiter for our public API?
              </p>
            </div>
          </div>

          {/* AI answer */}
          <div className="mx-3 mb-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                Suggested answer
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-200">
              Start with a token-bucket per API key in Redis — refill at the
              allowed rate, reject when empty…
            </p>
          </div>

          {/* Hotkey hint */}
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
            <span className="text-[11px] text-zinc-500">Ask anything</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
              Ctrl + Enter
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
