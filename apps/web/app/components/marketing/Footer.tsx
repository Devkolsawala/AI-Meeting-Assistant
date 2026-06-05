import Link from "next/link";
import { DiscordLogo, GitHubLogo, XLogo } from "./icons";

const PRODUCT = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Download", href: "/download" },
  { label: "Changelog", href: "#" },
];

const COMPANY = [
  { label: "Blog", href: "#" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact", href: "#" },
];

const LINK_CLASS = "text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[#0A0A0A]";

function ComingSoon() {
  return (
    <span className="ml-2 rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
      coming soon
    </span>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white px-6 pb-10 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-accent">●</span>
              <span className="font-display font-semibold text-[#0A0A0A]">MeetCopilot</span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Real-time AI for every meeting.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Product
            </p>
            <ul className="space-y-2">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("#") ? (
                    <a href={l.href} className={LINK_CLASS}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={LINK_CLASS}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Company
            </p>
            <ul className="space-y-2">
              {COMPANY.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("#") ? (
                    <a href={l.href} className={LINK_CLASS}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={LINK_CLASS}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Platform
            </p>
            <ul className="space-y-2">
              <li className="text-sm font-medium text-[#0A0A0A]">Windows</li>
              <li className="flex items-center text-sm text-[var(--color-text-muted)]">
                macOS <ComingSoon />
              </li>
              <li className="flex items-center text-sm text-[var(--color-text-muted)]">
                Enterprise <ComingSoon />
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row">
          <span className="text-xs text-[var(--color-text-muted)]">© 2026 MeetCopilot</span>
          <div className="flex items-center gap-5 text-[var(--color-text-muted)]">
            <a href="#" aria-label="X" className="transition-colors hover:text-[#0A0A0A]">
              <XLogo className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Discord" className="transition-colors hover:text-[#0A0A0A]">
              <DiscordLogo className="h-4 w-4" />
            </a>
            <a href="#" aria-label="GitHub" className="transition-colors hover:text-[#0A0A0A]">
              <GitHubLogo className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
