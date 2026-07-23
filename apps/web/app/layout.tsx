import type { Metadata } from "next";
import Link from "next/link";

// Fonts ship with the repo via @fontsource — no build-time network fetch,
// so `pnpm build` works offline and behind firewalls.
import "@fontsource/shippori-mincho/500.css";
import "@fontsource/shippori-mincho/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yagura — the watchtower for your BNS names",
  description:
    "Never lose the BNS name you own. Never miss the one you want. Expiry alerts and availability watches for Bitcoin Name System names on Stacks.",
};

/**
 * Tower silhouette with a lit, breathing beacon — the one mark Yagura is
 * remembered by. The beacon dot pulses independent of the rest of the mark
 * (own animation, own timing) so it reads as "the fire is lit" rather than
 * a static logo.
 */
function TowerMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 21h16M6 21V11h12v10M8 11 5 8h14l-3 3M9 8V4.5L12 3l3 1.5V8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <path d="M12 21v-4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="4" r="1.4" fill="var(--color-shu)" className="animate-beacon-pulse" />
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="grain" aria-hidden />
        <header className="sticky top-0 z-50 border-b border-ink-line bg-ink/85 backdrop-blur-md">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="group flex items-center gap-2.5 text-washi">
              <TowerMark className="h-6 w-6 text-ink-line transition-colors group-hover:text-shu" />
              <span className="font-display text-lg tracking-wide">
                Yagura <span className="text-washi-dim">櫓</span>
              </span>
            </Link>
            <div className="flex items-center gap-6 font-mono text-[13px] text-washi-dim">
              <Link href="/dashboard" className="transition-colors hover:text-washi">
                dashboard
              </Link>
              <Link href="/metrics" className="transition-colors hover:text-washi">
                metrics
              </Link>
            </div>
          </nav>
        </header>
        <main className="relative mx-auto max-w-5xl px-5">{children}</main>
        <footer className="mt-24 border-t border-ink-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-xs text-washi-dim">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-moss animate-scan" aria-hidden />
              yagura（櫓）— the lookout tower of a Japanese castle.
            </span>
            <span>
              complements{" "}
              <a href="https://bns.one" className="underline decoration-ink-line underline-offset-4 hover:text-washi">
                bns.one
              </a>{" "}
              · not affiliated
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
