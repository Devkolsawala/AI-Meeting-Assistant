import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MeetCopilot",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <div className="mx-auto max-w-2xl px-5 py-20">
        <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Draft — to be finalized before launch.</p>

        <div className="mt-8 space-y-6 leading-relaxed text-zinc-600">
          <p>
            This page is a placeholder for MeetCopilot&apos;s terms of service.
            The full terms will be published here before general availability.
          </p>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Acceptable use</h2>
            <p className="mt-2">
              MeetCopilot is intended for legitimate meetings. Use it only where
              it is permitted, and be transparent with the people you meet with.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Availability</h2>
            <p className="mt-2">
              The desktop app is currently available for Windows. Features and
              plans described on this site are subject to change while the
              product is in active development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
