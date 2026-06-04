import { NextResponse } from "next/server";

// Read the installer URL at request time so changing the env var takes effect
// without a code change. The URL stays server-side; clients only ever see the
// resulting 302.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const installerUrl = process.env.INSTALLER_DOWNLOAD_URL?.trim();

  if (installerUrl) {
    return NextResponse.redirect(installerUrl, 302);
  }

  // No build published yet — send visitors to the on-page waitlist instead.
  return NextResponse.redirect(new URL("/#download", request.url), 302);
}
