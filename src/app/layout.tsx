import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/i18n";
import { getSiteUrl } from "@/lib/site-url";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "CSGO Learning",
  title: { default: "CSGO Learning | Practical Courses and Verified Certificates", template: "%s | CSGO Learning" },
  description: "Build practical skills with structured online courses, assessments, learning paths, and certificates anyone can verify.",
  keywords: ["online courses", "professional learning", "skills training", "assessments", "verified certificates", "learning paths"],
  openGraph: {
    type: "website",
    siteName: "CSGO Learning",
    title: "CSGO Learning | Practical Courses and Verified Certificates",
    description: "Build practical skills with structured online courses, assessments, learning paths, and certificates anyone can verify.",
    images: [{ url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&h=630&q=75", width: 1200, height: 630, alt: "Learners studying together" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CSGO Learning | Practical Courses and Verified Certificates",
    description: "Build practical skills with structured online courses, assessments, learning paths, and certificates anyone can verify.",
    images: ["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&h=630&q=75"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17443e" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <head><link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" /></head>
      <body className="font-sans min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
