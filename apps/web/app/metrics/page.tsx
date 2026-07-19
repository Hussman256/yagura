import type { Metadata } from "next";

import { getPublicMetrics } from "@/lib/metrics";

export const metadata: Metadata = { title: "Metrics · Yagura" };
export const revalidate = 300;

/**
 * Public metrics — the numbers grant reviewers (and anyone else) can hold us
 * to. Everything reads straight from the operational tables; a fresh deploy
 * shows honest zeros, not seeded vanity.
 */
export default async function MetricsPage() {
  const metrics = await getPublicMetrics().catch(() => null);

  const stats = [
    { label: "names monitored", value: metrics?.namesMonitored, hint: "distinct names with live on-chain state" },
    { label: "alerts delivered", value: metrics?.alertsDelivered, hint: "messages that reached a human (suppressed tiers excluded)" },
    { label: "names rescued", value: metrics?.namesRescued, hint: "entered grace on our watch, renewed in time" },
    { label: "availability watches", value: metrics?.watchesActive, hint: "names being stalked for their comeback" },
  ];

  const weekly = metrics?.weeklyAlerts ?? [];
  const max = Math.max(1, ...weekly.map((w) => w.count));

  return (
    <div className="py-16">
      <p className="font-mono text-[13px] tracking-[0.25em] text-washi-dim uppercase">
        public metrics
      </p>
      <h1 className="mt-3 font-display text-4xl text-washi">The watch, measured</h1>

      {metrics === null && (
        <p className="mt-8 font-mono text-sm text-washi-dim">
          No database connected to this deployment — metrics are served by the
          worker&apos;s database in production.
        </p>
      )}

      <div className="mt-12 grid grid-cols-1 gap-px border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-ink-raised p-6">
            <div className="font-mono text-4xl text-washi">
              {stat.value === undefined ? "—" : stat.value.toLocaleString("en-US")}
            </div>
            <div className="mt-2 font-mono text-xs tracking-wider text-washi-dim uppercase">
              {stat.label}
            </div>
            <div className="mt-3 text-xs leading-relaxed text-washi-dim">{stat.hint}</div>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="font-mono text-xs tracking-wider text-washi-dim uppercase">
          alerts delivered per week
        </h2>
        {weekly.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-washi-dim">
            Nothing delivered yet — the tower was just built.
          </p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-2 border-b border-ink-line pb-px">
            {weekly.map((week) => (
              <div key={week.week} className="group flex flex-1 flex-col items-center gap-2">
                <span className="font-mono text-[10px] text-washi-dim opacity-0 transition-opacity group-hover:opacity-100">
                  {week.count}
                </span>
                <div
                  className="w-full max-w-14 bg-shu/80 transition-colors group-hover:bg-shu"
                  style={{ height: `${Math.max(4, (week.count / max) * 120)}px` }}
                />
                <span className="font-mono text-[10px] text-washi-dim">
                  {week.week.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-16 max-w-xl font-mono text-xs leading-relaxed text-washi-dim">
        Counted from the same tables the alert engine runs on
        (`name_state`, `alerts_sent`) — an alert only counts once it was
        actually handed to Telegram or the email provider.
      </p>
    </div>
  );
}
