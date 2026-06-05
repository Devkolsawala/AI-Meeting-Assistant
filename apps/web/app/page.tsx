import type { Metadata } from "next";
import { DownloadCTA } from "./components/marketing/DownloadCTA";
import { FAQ } from "./components/marketing/FAQ";
import { FeaturesBento } from "./components/marketing/FeaturesBento";
import { Footer } from "./components/marketing/Footer";
import { Hero } from "./components/marketing/Hero";
import { HowItWorks } from "./components/marketing/HowItWorks";
import { LogosBar } from "./components/marketing/LogosBar";
import { Navbar } from "./components/marketing/Navbar";
import { Pricing } from "./components/marketing/Pricing";
import { Stats } from "./components/marketing/Stats";
import { Testimonials } from "./components/marketing/Testimonials";
import { Undetectable } from "./components/marketing/Undetectable";

export const metadata: Metadata = {
  title: "MeetCopilot — Real-time AI for every meeting",
  description:
    "Real-time AI answers, invisible overlay, and post-meeting summaries. No bots in the room. Free to start on Windows.",
  keywords:
    "AI meeting assistant, real-time meeting notes, invisible AI, no bot meeting, meeting copilot, live AI answers",
  openGraph: {
    title: "MeetCopilot — Real-time AI for every meeting",
    description:
      "Live AI answers through an invisible overlay. No bots. No recordings. Free to start.",
    url: "https://ai-meeting-assistant-web-sand.vercel.app",
    siteName: "MeetCopilot",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function HomePage() {
  const installerAvailable = Boolean(process.env.INSTALLER_DOWNLOAD_URL?.trim());

  return (
    <div className="min-h-screen bg-[var(--color-bg)] font-body text-[#0A0A0A] antialiased">
      <Navbar />
      {/* max-w-none/p-0 override the auth-page `main` base rule in globals.css. */}
      <main className="m-0 block w-full max-w-none p-0">
        <Hero />
        <LogosBar />
        <HowItWorks />
        <FeaturesBento />
        <Undetectable />
        <Stats />
        <Testimonials />
        <Pricing />
        <FAQ />
        <DownloadCTA installerAvailable={installerAvailable} />
      </main>
      <Footer />
    </div>
  );
}
