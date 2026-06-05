import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "./components/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetCopilot — Real-time AI for every meeting",
  description:
    "MeetCopilot listens to your calls and gives you live AI answers, notes, and post-meeting summaries — in a private overlay that stays hidden during screen share. Windows desktop app.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        {children}
      </body>
    </html>
  );
}
