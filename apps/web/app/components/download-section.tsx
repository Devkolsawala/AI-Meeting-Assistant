"use client";

import { DownloadCta } from "./download-cta";
import { useOS } from "./use-os";
import { WaitlistForm } from "./waitlist-form";

interface DownloadSectionProps {
  installerAvailable: boolean;
  version: string;
  requirement: string;
}

/**
 * OS-aware download card. Windows visitors get the download button + version
 * and requirements; macOS/other visitors get an honest "Windows only for now"
 * message and a waitlist. Renders the Windows variant until OS detection runs,
 * so SSR and the first client render match.
 */
export function DownloadSection({
  installerAvailable,
  version,
  requirement,
}: DownloadSectionProps) {
  const os = useOS();
  const onOtherPlatform = os === "other";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-sky-50 to-white p-8 text-center shadow-sm sm:p-12">
      <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
        Download MeetCopilot
      </h2>

      {onOtherPlatform ? (
        <>
          <p className="mx-auto mt-4 max-w-xl text-zinc-600">
            MeetCopilot is Windows only for now. Leave your email and we&apos;ll
            tell you when a build for your platform is ready.
          </p>
          <div className="mx-auto mt-8 max-w-lg">
            <WaitlistForm
              storageKey="meetcopilot:platform-waitlist"
              successMessage="You're on the list — we'll email you when a build for your platform is ready."
            />
          </div>
        </>
      ) : (
        <>
          <p className="mx-auto mt-4 max-w-xl text-zinc-600">
            The desktop app for Windows. Version {version} · {requirement}.
          </p>
          <div className="mt-8 flex justify-center">
            <DownloadCta installerAvailable={installerAvailable} />
          </div>

          <div className="mx-auto mt-12 max-w-lg border-t border-zinc-200 pt-8">
            <h3 className="text-lg font-semibold">On a Mac?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              MeetCopilot is Windows only for now. Leave your email and
              we&apos;ll tell you when the macOS build lands.
            </p>
            <div className="mt-5">
              <WaitlistForm />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
