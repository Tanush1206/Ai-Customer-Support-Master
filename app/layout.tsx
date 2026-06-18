import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="grain min-h-dvh bg-paper text-ink antialiased">
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
        <footer className="mt-12 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
            <p className="eyebrow">Nimbus Support Desk · Est. 2026</p>
            <nav className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              <Link href="/" className="transition-colors hover:text-accent">
                Chat
              </Link>
              <Link href="/desk" className="transition-colors hover:text-accent">
                The Desk
              </Link>
              <span className="text-ink-soft/60">© 2026 Nimbus</span>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
