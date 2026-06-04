"use client";

import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error_description") ?? params.get("error");
    if (callbackError) {
      setError(callbackError);
      return;
    }
    const code = params.get("code");
    const state = params.get("state") ?? "";
    if (!code) {
      setError("Missing authorization code.");
      return;
    }
    const link = `meetcopilot://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    setDeepLink(link);
    // Hand the code back to the desktop app via the custom protocol.
    window.location.href = link;
  }, []);

  if (error) {
    return (
      <main>
        <h1>Sign-in failed</h1>
        <p className="message">{error}</p>
        <p>You can close this tab and try again from the MeetCopilot app.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Returning to MeetCopilot…</h1>
      <p>You can close this tab once the app is in focus.</p>
      {deepLink && (
        <p>
          If nothing happens,{" "}
          <a href={deepLink} className="link">
            click here to open MeetCopilot
          </a>
          .
        </p>
      )}
    </main>
  );
}
