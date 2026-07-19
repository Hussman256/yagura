import Link from "next/link";

import { telegramBotUrl } from "@/lib/bns";
import { getPublicMetrics } from "@/lib/metrics";

export const revalidate = 300; // counters refresh every 5 minutes

function Counter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border-l border-ink-line pl-4">
      <div className="font-mono text-3xl text-washi">
        {value === null ? "—" : value.toLocaleString("en-US")}
      </div>
      <div className="mt-1 font-mono text-xs tracking-wider text-washi-dim uppercase">
        {label}
      </div>
    </div>
  );
}

export default async function Landing() {
  const metrics = await getPublicMetrics().catch(() => null);
  const botUrl = telegramBotUrl();

  return (
    <div className="py-20 md:py-28">
      {/* Hero — asymmetric: text column pushed left, tall empty sightline right */}
      <section className="grid gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div>
          <p className="rise rise-1 font-mono text-[13px] tracking-[0.25em] text-shu uppercase">
            watchtower · bitcoin name system · stacks
          </p>
          <h1 className="rise rise-2 mt-6 font-display text-5xl leading-[1.08] text-washi md:text-6xl">
            Never lose the name you own.
            <br />
            <span className="text-washi-dim">Never miss the one you want.</span>
          </h1>
          <p className="rise rise-3 mt-8 max-w-xl text-[15px] leading-relaxed text-washi-dim">
            BNS names expire by Bitcoin block height, silently. Yagura watches
            the chain and pushes a warning to your Telegram or inbox at 30, 7
            and 1 days out — with a one-tap renewal link that opens your
            wallet, pre-filled. Watching a name someone else holds? You&apos;ll
            hear the moment it becomes claimable.
          </p>
          <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
            {botUrl ? (
              <a
                href={botUrl}
                className="border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
              >
                → alerts via Telegram
              </a>
            ) : (
              <Link
                href="/dashboard"
                className="border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
              >
                → open the dashboard
              </Link>
            )}
            <Link
              href="/dashboard"
              className="border border-ink-line px-6 py-3 font-mono text-sm text-washi-dim transition-colors hover:border-washi-dim hover:text-washi"
            >
              connect wallet
            </Link>
          </div>
        </div>

        {/* The tower, watching. */}
        <div className="rise rise-3 hidden items-end justify-end md:flex">
          <svg viewBox="0 0 120 240" className="h-72 text-ink-line" fill="none" aria-hidden>
            <path
              d="M20 236h80M32 236V140h56v96M28 140 16 116h88l-12 24M40 116V64L60 52l20 12v52M60 236v-40M48 92h24M60 52V28"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            />
            <circle cx="60" cy="22" r="3" className="text-shu" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </section>

      {/* Live counters — real numbers from the alert ledger */}
      <section className="mt-24 grid grid-cols-2 gap-8 md:grid-cols-4">
        <Counter label="names monitored" value={metrics?.namesMonitored ?? null} />
        <Counter label="alerts delivered" value={metrics?.alertsDelivered ?? null} />
        <Counter label="names rescued" value={metrics?.namesRescued ?? null} />
        <Counter label="availability watches" value={metrics?.watchesActive ?? null} />
      </section>

      {/* How it works — three terse steps */}
      <section className="mt-24 grid gap-10 border-t border-ink-line pt-12 md:grid-cols-3">
        {[
          {
            n: "01",
            title: "Point the watchtower",
            body: "Connect a wallet or tell the bot your address — every name you own is tracked automatically. Or watch any name you're waiting on.",
          },
          {
            n: "02",
            title: "Get the signal in time",
            body: "Alerts at ~30 / 7 / 1 days before expiry, again when the grace period starts, and the instant a watched name becomes claimable.",
          },
          {
            n: "03",
            title: "Act in one tap",
            body: "Every alert links to /renew — your wallet opens with the exact name-renewal contract call and a burn post-condition already set.",
          },
        ].map((step) => (
          <div key={step.n}>
            <div className="font-mono text-xs text-shu">{step.n}</div>
            <h2 className="mt-3 font-display text-xl text-washi">{step.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-washi-dim">{step.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
