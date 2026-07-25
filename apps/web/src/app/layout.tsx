import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// "Instrument" design direction: Space Grotesk (display) + Inter (body) + JetBrains Mono
// (tabular numerals). Exposed as CSS variables; applied per-screen while we prototype.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-num",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Baseline - Dashboard",
  description: "Baseline product dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} antialiased bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100`}
      >
        {children}
      </body>
    </html>
  );
}
