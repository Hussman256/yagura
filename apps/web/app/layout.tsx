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

/** Tower silhouette — the one mark Yagura is remembered by. */
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
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-ink-line">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2.5 text-washi">
              <TowerMark className="h-6 w-6 text-shu" />
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
              <a
                href="https://github.com/yagura-bns/yagura"
                className="transition-colors hover:text-washi"
              >
                source
              </a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-5">{children}</main>
        <footer className="mt-24 border-t border-ink-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-xs text-washi-dim">
            <span>
              yagura（櫓）— the lookout tower of a Japanese castle. MIT licensed.
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
