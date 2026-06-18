import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Nimbus Support Desk",
  description:
    "The Nimbus support desk — an AI agent that resolves common issues and hands edge cases to a human with full context.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="grain min-h-dvh bg-paper text-ink antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <header className="sticky top-0 z-30 border-b border-line-strong bg-paper/85 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-4">
              <Link href="/" className="group flex items-baseline gap-3">
                <span className="font-display text-3xl font-semibold tracking-tight leading-none">
                  Nimbus
                </span>
                <span className="eyebrow hidden sm:block">The Support Desk · Est. 2026</span>
              </Link>
              <nav className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em]">
                <Link
                  href="/"
                  className="rounded-full px-3 py-1.5 text-ink-soft transition-colors hover:bg-ink hover:text-paper"
                >
                  Chat
                </Link>
                <Link
                  href="/desk"
                  className="rounded-full px-3 py-1.5 text-ink-soft transition-colors hover:bg-ink hover:text-paper"
                >
                  The Desk
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

