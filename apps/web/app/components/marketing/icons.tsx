// Minimal inline SVG icons for the marketing site (avoids an icon-library dep).
// All inherit currentColor and take an optional className.

type IconProps = { className?: string };

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function ZapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
      <path strokeLinecap="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.9 3.5M6.5 6.6C4 8 2 10.6 2 12c0 2.5 4 7 10 7 1.6 0 3-.3 4.3-.9"
      />
      <path strokeLinecap="round" d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function XLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.2 2H21l-6.5 7.4L22 22h-6l-4.7-6.1L5.9 22H3l7-8L2 2h6.1l4.3 5.6L18.2 2Zm-1 18h1.7L7.9 3.8H6.1L17.2 20Z" />
    </svg>
  );
}

export function GitHubLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.3-1.1.6-1.4-2.2-.300000000000004-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function DiscordLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.2.4a12 12 0 0 1 3.4 1.7 14 14 0 0 0-12 0A12 12 0 0 1 9.9 4.4L9.6 4a16 16 0 0 0-3.9 1.3C2.9 9.5 2.2 13.6 2.5 17.6a16 16 0 0 0 4.8 2.4l.6-1a10 10 0 0 1-1.7-.8l.4-.3a11.5 11.5 0 0 0 9.8 0l.4.3a10 10 0 0 1-1.7.8l.6 1a16 16 0 0 0 4.8-2.4c.4-4.7-.7-8.8-3.5-12.3ZM9 15c-.8 0-1.5-.8-1.5-1.7S8.2 11.6 9 11.6s1.5.8 1.5 1.7S9.8 15 9 15Zm6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7S15.8 15 15 15Z" />
    </svg>
  );
}
