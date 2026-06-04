"use client";

import { useState } from "react";
import { NotifyModal } from "./notify-modal";
import { useOS } from "./use-os";
import { WaitlistForm } from "./waitlist-form";

export const DOWNLOAD_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50";

interface DownloadCtaProps {
  /** Whether INSTALLER_DOWNLOAD_URL is configured on the server. */
  installerAvailable: boolean;
  label?: string;
  className?: string;
}

/**
 * The primary "Get for Windows" call to action. On Windows with a published
 * installer it links to the server-side /download redirect; otherwise it opens
 * a notify-me modal (the installer URL never reaches the client).
 */
export function DownloadCta({
  installerAvailable,
  label = "Get for Windows",
  className = DOWNLOAD_BUTTON_CLASS,
}: DownloadCtaProps) {
  const os = useOS();
  const [modalOpen, setModalOpen] = useState(false);

  // `os === null` during SSR / first render: default to the direct link.
  const directDownload = os === null || (os === "windows" && installerAvailable);

  const inner = (
    <>
      <WindowsLogo className="h-4 w-4" />
      {label}
    </>
  );

  if (directDownload) {
    return (
      <a href="/download" className={className}>
        {inner}
      </a>
    );
  }

  const onOtherPlatform = os === "other";
  const copy = onOtherPlatform
    ? {
        title: "MeetCopilot is Windows only — for now",
        description:
          "Leave your email and we'll let you know when a build for your platform is ready.",
        storageKey: "meetcopilot:platform-waitlist",
        success:
          "You're on the list — we'll email you when a build for your platform is ready.",
      }
    : {
        title: "The Windows build is on its way",
        description:
          "Downloads aren't open yet. Leave your email and we'll send you the installer the moment it's ready.",
        storageKey: "meetcopilot:windows-waitlist",
        success:
          "You're on the list — we'll email you the moment the Windows build is ready.",
      };

  return (
    <>
      <button type="button" className={className} onClick={() => setModalOpen(true)}>
        {inner}
      </button>
      <NotifyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={copy.title}
        description={copy.description}
      >
        <WaitlistForm storageKey={copy.storageKey} successMessage={copy.success} />
      </NotifyModal>
    </>
  );
}

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M3 5.1 10.4 4v7.3H3V5.1Zm0 13.8 7.4 1.1v-7.2H3v6.1Zm8.3 1.2L21 21.5V12.7h-9.7v7.4Zm0-16.6v7.4H21V2.5l-9.7 1Z" />
    </svg>
  );
}
