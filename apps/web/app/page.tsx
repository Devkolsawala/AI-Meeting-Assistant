import Link from "next/link";
import { DownloadCta } from "./components/download-cta";
import { DownloadSection } from "./components/download-section";
import { OverlayMockup } from "./components/overlay-mockup";

const APP_VERSION = "0.1.0";
const WINDOWS_REQUIREMENT = "Requires Windows 10 (build 2004+) or Windows 11";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const STEPS = [
  {
    title: "Capture both sides",
    body: "MeetCopilot listens to the meeting audio and your microphone as two separate channels, so it always knows who said what.",
  },
  {
    title: "Ask anything, live",
    body: "Press Ctrl + Enter and the AI streams an answer in the overlay — grounded in what was just said on the call.",
  },
  {
    title: "Stay in flow",
    body: "The overlay floats above your meeting and stays hidden during screen share. When you wrap up, you get a clean summary.",
  },
];

const FEATURES = [
  {
    title: "Dual-voice accuracy",
    body: "Separate transcription for you and the other side means cleaner context and sharper, more relevant answers.",
  },
  {
    title: "Private overlay",
    body: "Your notes and answers live in a floating window that's invisible during screen share — your screen stays yours.",
  },
  {
    title: "Personas",
    body: "Tune the assistant for the moment — interview prep, sales calls, standups — so suggestions match the conversation.",
  },
  {
    title: "Post-meeting summaries",
    body: "Walk away with a structured recap and action items, generated from the full labelled transcript.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Try it on your next call.",
    features: ["Live AI answers", "Dual-voice transcription", "Limited monthly usage"],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$20",
    cadence: "/ month",
    tagline: "For people in meetings all day.",
    features: ["Everything in Free", "Higher usage limits", "Personas", "Post-meeting summaries"],
    highlighted: true,
  },
  {
    name: "Power",
    price: "$49",
    cadence: "/ month",
    tagline: "Maximum headroom.",
    features: ["Everything in Pro", "Highest usage limits", "Priority model lane", "Priority support"],
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "Is this for cheating in interviews or exams?",
    a: "No. MeetCopilot is a real-time meeting assistant for legitimate calls — interviews you're conducting, sales calls, standups, customer meetings. Use it where it's allowed and be transparent with the people you're meeting.",
  },
  {
    q: "Why is the overlay hidden during screen share?",
    a: "It's a privacy feature. Your notes and AI answers are personal — they shouldn't leak onto a shared screen for everyone to see. The overlay stays visible to you and stays out of your screen capture.",
  },
  {
    q: "Which platforms are supported?",
    a: "Windows only for now. A macOS build is in the works — add your email below and we'll let you know the moment it's ready.",
  },
  {
    q: "How accurate is the transcription?",
    a: "MeetCopilot captures the meeting audio and your microphone as two separate channels and transcribes both in real time, which keeps speakers cleanly separated and improves accuracy.",
  },
  {
    q: "Where does my data go?",
    a: "Audio is transcribed and sent to the AI to generate answers during your call. Secrets and provider keys stay on our server — never in the desktop app. See our privacy policy for details.",
  },
];

export default function HomePage() {
  const installerAvailable = Boolean(process.env.INSTALLER_DOWNLOAD_URL?.trim());

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/5 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              M
            </span>
            <span>MeetCopilot</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-zinc-500 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-zinc-900">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Sign in
            </Link>
            <a
              href="#download"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Download
            </a>
          </div>
        </nav>
      </header>

      <main className="m-0 block w-full max-w-none p-0">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-white">
          {/* cool blue glow up top */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[560px] bg-[radial-gradient(circle_at_50%_-15%,rgba(37,99,235,0.30),transparent_60%)]"
          />
          {/* warm sunrise glow along the horizon, behind the mockup */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[460px] bg-[radial-gradient(ellipse_70%_60%_at_50%_118%,rgba(251,146,60,0.38),rgba(253,224,71,0.20)_42%,transparent_72%)]"
          />
          {/* faint dot grid, fading out toward the horizon */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 [background-image:radial-gradient(rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
          />
          <div className="relative z-10 mx-auto max-w-6xl px-5 pb-28 pt-20 text-center sm:pt-24">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Windows only for now
              </span>
              <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">
                Real-time AI for
                <br />
                every meeting.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600">
                MeetCopilot listens to your calls and gives you live answers,
                notes, and summaries — in a private overlay that stays hidden
                during screen share.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <DownloadCta installerAvailable={installerAvailable} />
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-3.5 text-base font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                Free to start · {WINDOWS_REQUIREMENT}
              </p>
            </div>

            {/* App mockup */}
            <div className="mt-20 px-1 sm:mt-24">
              <OverlayMockup />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
                A real-time loop, three steps.
              </h2>
              <p className="mt-4 text-zinc-600">
                MeetCopilot works alongside your call — no bots in the meeting,
                no recordings to dig through later.
              </p>
            </div>
            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-base font-bold text-blue-700">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-zinc-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-zinc-50 py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
                Built for the moments that matter.
              </h2>
              <p className="mt-4 text-zinc-600">
                Everything you need to stay sharp on a live call, and a clean
                recap when it&apos;s over.
              </p>
            </div>
            <div className="mt-16 grid gap-5 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 leading-relaxed text-zinc-600">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
                Simple pricing.
              </h2>
              <p className="mt-4 text-zinc-600">
                Start free. Upgrade when MeetCopilot earns a place in your
                workflow.
              </p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {PRICING.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    tier.highlighted
                      ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                      : "border-zinc-200 bg-white shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{tier.name}</h3>
                    {tier.highlighted && (
                      <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                    <span className="text-sm text-zinc-500">{tier.cadence}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{tier.tagline}</p>
                  <ul className="mt-6 space-y-2.5 text-sm text-zinc-700">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#download"
                    className={`mt-7 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                      tier.highlighted
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    Get started
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-zinc-500">
              Final plans and limits are being finalized — pricing shown is a
              preview.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-zinc-50 py-24">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              Questions, answered.
            </h2>
            <div className="mt-12 divide-y divide-zinc-200">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium text-zinc-900">
                    {item.q}
                    <PlusIcon className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-zinc-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Download / get started */}
        <section id="download" className="py-24">
          <div className="mx-auto max-w-3xl px-5">
            <DownloadSection
              installerAvailable={installerAvailable}
              version={APP_VERSION}
              requirement={WINDOWS_REQUIREMENT}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white">
              M
            </span>
            <span>© {new Date().getFullYear()} MeetCopilot</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="transition-colors hover:text-zinc-900">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-zinc-900">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path d="M9 3a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H3a1 1 0 1 1 0-2h6V3Z" />
    </svg>
  );
}
