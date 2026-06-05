import Link from "next/link";

export const metadata = {
  title: "Audio setup & troubleshooting — MeetCopilot",
};

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function WindowsAudioHelpPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <div className="mx-auto max-w-2xl px-5 py-20">
        <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Audio setup &amp; troubleshooting</h1>
        <p className="mt-2 text-sm text-zinc-500">
          MeetCopilot needs two audio sources: your <strong>microphone</strong> (&ldquo;You&rdquo;)
          and the meeting&apos;s <strong>system audio</strong> (&ldquo;Them&rdquo;). If the first-run
          setup flagged a problem, these steps fix the common ones (Windows).
        </p>

        <div className="mt-8 space-y-7 leading-relaxed text-zinc-600">
          <Step title="Microphone is blocked">
            <p>
              Open <strong>Windows Settings → Privacy &amp; security → Microphone</strong>. Turn on{" "}
              <em>Microphone access</em> and <em>Let apps access your microphone</em>, and make sure{" "}
              <em>Let desktop apps access your microphone</em> is on.
            </p>
            <p>Then reopen MeetCopilot and run the setup check again.</p>
          </Step>

          <Step title="No system audio (&ldquo;Them&rdquo; stays silent)">
            <p>
              When MeetCopilot asks to capture the screen, <strong>allow it</strong> — that is how
              Windows lets the app hear the meeting&apos;s audio (system loopback). System audio
              capture is Windows-only.
            </p>
            <p>
              Make sure the meeting is actually playing through your default playback device, and
              that the meeting app or browser tab is not muted.
            </p>
          </Step>

          <Step title="Still not working?">
            <p>
              Fully quit MeetCopilot and relaunch after changing any Windows setting — permission
              changes are picked up on the next start. Restarting Windows clears stuck audio devices.
            </p>
            <p>If it still fails, contact support and include what the setup screen reported.</p>
          </Step>
        </div>
      </div>
    </div>
  );
}
