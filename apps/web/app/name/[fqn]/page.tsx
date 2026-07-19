import type { Metadata } from "next";
import Link from "next/link";

import { getBns, telegramWatchUrl } from "@/lib/bns";
import { describeExpiry, STATUS_META } from "@/lib/format";

/**
 * Public status page for any BNS name — resolves live on request (cached
 * briefly), shareable and indexable. The action column adapts: renew when
 * expiring, register when claimable, watch always.
 */

export const revalidate = 60;

interface Props {
  params: Promise<{ fqn: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fqn } = await params;
  const decoded = decodeURIComponent(fqn);
  return {
    title: `${decoded} — BNS status · Yagura`,
    description: `Live expiry status, owner, and availability of ${decoded} on the Bitcoin Name System.`,
  };
}

export default async function NamePage({ params }: Props) {
  const { fqn } = await params;
  const decoded = decodeURIComponent(fqn).toLowerCase();

  let state;
  try {
    state = await getBns().resolveName(decoded);
  } catch {
    return (
      <div className="py-24">
        <h1 className="font-display text-3xl">{decoded}</h1>
        <p className="mt-4 font-mono text-sm text-washi-dim">
          Couldn&apos;t reach the chain just now — refresh in a minute.
        </p>
      </div>
    );
  }

  const meta = STATUS_META[state.status];
  const expiry = describeExpiry(state.renewalHeight, state.currentBurnBlock);
  const claimable = state.status === "available" || state.status === "unregistered";
  const botUrl = telegramWatchUrl(decoded);
  const registerUrl = `https://bns.one/register?search=${encodeURIComponent(decoded.split(".")[0] ?? decoded)}`;

  return (
    <div className="py-20">
      <p className="rise rise-1 font-mono text-[13px] tracking-[0.25em] text-washi-dim uppercase">
        name status
      </p>
      <div className="rise rise-2 mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <h1 className="font-display text-4xl break-all text-washi md:text-5xl">{decoded}</h1>
        <span className={`border px-3 py-1 font-mono text-xs ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      <dl className="rise rise-3 mt-12 grid max-w-2xl gap-x-10 gap-y-6 border-t border-ink-line pt-8 font-mono text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">owner</dt>
          <dd className="mt-1 break-all text-washi">{state.owner ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">
            {state.renewalHeight !== null && state.currentBurnBlock >= state.renewalHeight
              ? "expired"
              : "expires"}
          </dt>
          <dd className="mt-1 text-washi">
            {state.status === "nonexpiring" ? "never" : (expiry ?? "—")}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">renewal height</dt>
          <dd className="mt-1 text-washi">
            {state.renewalHeight?.toLocaleString("en-US") ?? "—"}
            <span className="text-washi-dim"> / now {state.currentBurnBlock.toLocaleString("en-US")}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">namespace</dt>
          <dd className="mt-1 text-washi">
            .{state.namespace}
            {state.isManaged ? " (managed)" : ""}
            {state.lifetime > 0
              ? ` · ${state.lifetime.toLocaleString("en-US")} block lifetime`
              : " · non-expiring"}
          </dd>
        </div>
      </dl>

      <div className="rise rise-4 mt-12 flex flex-wrap gap-4">
        {claimable ? (
          <a
            href={registerUrl}
            className="border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
          >
            → register on BNS One
          </a>
        ) : state.status !== "nonexpiring" && state.status !== "unknown" ? (
          <Link
            href={`/renew/${encodeURIComponent(decoded)}`}
            className="border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
          >
            → renew this name
          </Link>
        ) : null}
        {botUrl && (
          <a
            href={botUrl}
            className="border border-ink-line px-6 py-3 font-mono text-sm text-washi-dim transition-colors hover:border-washi-dim hover:text-washi"
          >
            watch via Telegram
          </a>
        )}
      </div>

      <p className="mt-10 max-w-xl font-mono text-xs leading-relaxed text-washi-dim">
        Dates are estimates at ~10 minutes per Bitcoin block, recomputed on
        every view. Expiry is decided by block height, not the calendar.
      </p>
    </div>
  );
}
