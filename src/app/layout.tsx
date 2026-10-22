import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aarogya Copilot — AI Personal Health Copilot",
  description:
    "Turn prescriptions, lab reports and discharge summaries into one trustworthy health timeline — with visible uncertainty, source-level provenance, plain-language explanation in four languages, and ABDM-ready FHIR export.",
  keywords: [
    "AI health copilot",
    "medical OCR",
    "FHIR R4",
    "ABDM",
    "ABHA",
    "health records",
    "prescription OCR",
  ],
  authors: [{ name: "Aarogya Copilot" }],
  openGraph: {
    title: "Aarogya Copilot — AI Personal Health Copilot",
    description:
      "Your health history, finally in one place. Trust-gated extraction, plain-language explanation, ABDM-ready FHIR export.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sora.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
