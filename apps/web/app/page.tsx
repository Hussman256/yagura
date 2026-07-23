import Link from "next/link";

import { telegramBotUrl } from "@/lib/bns";
import { getPublicMetrics } from "@/lib/metrics";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";

export const revalidate = 300; // counters refresh every 5 minutes

function Counter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border-l border-ink-line pl-4">
      <div className="font-mono text-3xl text-washi tabular-nums">
        {value === null ? "—" : <CountUp value={value} />}
      </div>
      <div className="mt-1 font-mono text-xs tracking-wider text-washi-dim uppercase">
        {label}
      </div>
    </div>
  );
}

/** Fixed positions/timings for the embers rising off the beacon — server-rendered, no JS. */
const EMBERS = [
  { left: "48%", delay: "0s", duration: "5.2s", drift: "-10px", size: "3px" },
  { left: "53%", delay: "1.1s", duration: "6s", drift: "14px", size: "2px" },
  { left: "45%", delay: "2.3s", duration: "4.6s", drift: "6px", size: "2px" },
  { left: "56%", delay: "3.1s", duration: "5.8s", drift: "-8px", size: "3px" },
  { left: "50%", delay: "0.6s", duration: "5s", drift: "18px", size: "2px" },
];

export default async function Landing() {
  const metrics = await getPublicMetrics().catch(() => null);
  const botUrl = telegramBotUrl();

  const tickerText = metrics
    ? `watching ${metrics.namesMonitored.toLocaleString("en-US")} names · ${metrics.alertsDelivered.toLocaleString("en-US")} alerts delivered · ${metrics.namesRescued.toLocaleString("en-US")} rescued from expiry · `
    : "watchtower active · monitoring the bitcoin name system on stacks · ";

  return (
    <div className="py-16 md:py-20">
      {/* Status ticker — a control-room strip above the fold. */}
      <div className="rise rise-1 -mx-5 overflow-hidden border-y border-ink-line px-5 py-2.5 sm:-mx-0 sm:border-x">
        <div className="flex w-max animate-marquee font-mono text-[11px] tracking-[0.2em] text-washi-dim uppercase">
          <span className="flex items-center gap-2 pr-2">
            <span className="h-1.5 w-1.5 rounded-full bg-moss animate-scan" aria-hidden />
            {tickerText}
          </span>
          <span className="flex items-center gap-2 pr-2" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-moss animate-scan" />
            {tickerText}
          </span>
        </div>
      </div>

      {/* Hero — asymmetric: text column pushed left, the tower keeping watch right. */}
      <section className="relative mt-16 grid gap-12 overflow-hidden md:mt-20 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="beacon-glow" aria-hidden />
        <span
          className="watermark -top-10 -right-6 text-[clamp(9rem,26vw,20rem)] md:right-8"
          aria-hidden
        >
          櫓
        </span>

        <div className="relative">
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
                className="group relative border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-all hover:bg-transparent hover:text-shu hover:shadow-[0_0_24px_-4px_rgb(229_72_77_/_0.6)]"
              >
                → alerts via Telegram
              </a>
            ) : (
              <Link
                href="/dashboard"
                className="group relative border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-all hover:bg-transparent hover:text-shu hover:shadow-[0_0_24px_-4px_rgb(229_72_77_/_0.6)]"
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

        {/* The tower, watching — beacon sweeping, embers rising off the fire. */}
        <div className="rise rise-3 relative hidden items-end justify-end md:flex">
          <div className="relative h-72 w-[120px]">
            {EMBERS.map((ember, i) => (
              <span
                key={i}
                className="absolute top-14 rounded-full bg-shu animate-ember-rise"
                style={
                  {
                    left: ember.left,
                    width: ember.size,
                    height: ember.size,
                    animationDelay: ember.delay,
                    animationDuration: ember.duration,
                    "--drift": ember.drift,
                  } as React.CSSProperties
                }
              />
            ))}
            <svg viewBox="0 0 120 240" className="h-72 w-[120px] text-ink-line" fill="none" aria-hidden>
              <g style={{ transformOrigin: "60px 22px" }} className="animate-beacon-sweep">
                <line x1="60" y1="22" x2="60" y2="-52" stroke="url(#beam)" strokeWidth="4" />
              </g>
              <path
                d="M20 236h80M32 236V140h56v96M28 140 16 116h88l-12 24M40 116V64L60 52l20 12v52M60 236v-40M48 92h24M60 52V28"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              />
              <circle
                cx="60"
                cy="22"
                r="3.5"
                fill="var(--color-shu)"
                className="animate-beacon-pulse"
              />
              <defs>
                <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#e5484d" stopOpacity="0" />
                  <stop offset="100%" stopColor="#e5484d" stopOpacity="0.55" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* Live counters — real numbers from the alert ledger */}
      <Reveal>
        <section className="mt-24 grid grid-cols-2 gap-8 md:grid-cols-4">
          <Counter label="names monitored" value={metrics?.namesMonitored ?? null} />
          <Counter label="alerts delivered" value={metrics?.alertsDelivered ?? null} />
          <Counter label="names rescued" value={metrics?.namesRescued ?? null} />
          <Counter label="availability watches" value={metrics?.watchesActive ?? null} />
        </section>
      </Reveal>

      {/* How it works — three terse steps, read top to bottom like a watch log */}
      <section className="relative mt-24 grid gap-10 border-t border-ink-line pt-12 md:grid-cols-3">
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
        ].map((step, i) => (
          <Reveal key={step.n} delayMs={i * 120}>
            <div>
              <div className="font-mono text-xs text-shu">{step.n}</div>
              <h2 className="mt-3 font-display text-xl text-washi">{step.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-washi-dim">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
