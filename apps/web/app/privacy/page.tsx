import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — MeetCopilot",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <div className="mx-auto max-w-2xl px-5 py-20">
        <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Draft — to be finalized before launch.</p>

        <div className="mt-8 space-y-6 leading-relaxed text-zinc-600">
          <p>
            MeetCopilot is a real-time meeting assistant. This page is a
            placeholder outlining our intended approach to privacy; the full
            policy will be published here before general availability.
          </p>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">What we process</h2>
            <p className="mt-2">
              During a call, meeting audio and your microphone are transcribed
              and sent to our AI to generate live answers and summaries. We use
              this only to provide the service.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Secrets and keys</h2>
            <p className="mt-2">
              Provider API keys and other secrets live on our server only —
              never in the desktop app and never in your browser.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p className="mt-2">
              Questions about privacy? Reach out and we&apos;ll help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
