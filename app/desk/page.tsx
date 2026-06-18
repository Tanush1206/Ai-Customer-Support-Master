import Link from "next/link";
import Admin from "@/components/admin/Admin";

export default function DeskPage() {
  return (
    <>
      <Admin />
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
    </>
  );
}
