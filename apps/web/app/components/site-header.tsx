import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared top nav for the utility pages (/login, /account) so they match the
 * marketing landing page's chrome. `action` renders on the right.
 */
export function SiteHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900/5 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            M
          </span>
          <span>MeetCopilot</span>
        </Link>
        {action}
      </nav>
    </header>
  );
}
