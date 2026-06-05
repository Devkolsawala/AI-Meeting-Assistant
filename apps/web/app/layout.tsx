import type { Metadata, Viewport } from "next";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Analytics } from "./components/analytics";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MeetCopilot — Real-time AI for every meeting",
  description:
    "MeetCopilot listens to your calls and gives you live AI answers, notes, and post-meeting summaries — in a private overlay that stays hidden during screen share. Windows desktop app.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F9F7F4",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${lora.variable}`}>
      <body>
        <Analytics />
        {children}
      </body>
    </html>
  );
}
