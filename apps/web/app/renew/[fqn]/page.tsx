import type { Metadata } from "next";
import Link from "next/link";

import { BNS_V2_CONTRACT_ID, splitFqn } from "@yagura/core";

import { getBns } from "@/lib/bns";
import { describeExpiry, STATUS_META } from "@/lib/format";
import { EmberBar } from "@/components/ember-bar";
import { RenewButton } from "./renew-button";

/**
 * /renew/[fqn] — the deep-link every expiry alert carries. Resolves the name
 * and its exact renewal price server-side, then hands both to the wallet
 * button. Never cached: the price and status must be current when signing.
 */

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ fqn: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fqn } = await params;
  return { title: `Renew ${decodeURIComponent(fqn)} · Yagura` };
}

export default async function RenewPage({ params }: Props) {
  const { fqn } = await params;
  const decoded = decodeURIComponent(fqn).toLowerCase();

  let parsed: { name: string; namespace: string };
  try {
    parsed = splitFqn(decoded);
  } catch {
    return <Message title={decoded} body="That isn't a valid name.namespace." />;
  }

  let state, priceUstx;
  try {
    [state, priceUstx] = await Promise.all([
      getBns().resolveName(decoded),
      getBns().getRenewalPriceUstx(decoded),
    ]);
  } catch {
    return (
      <Message
        title={decoded}
        body="Couldn't fetch the name or its renewal price from the chain — refresh in a minute. Nothing was signed."
      />
    );
  }

  if (state.status === "nonexpiring") {
    return (
      <Message
        title={decoded}
        body={`Good news: names in .${state.namespace} never expire. There is nothing to renew.`}
      />
    );
  }
  if (state.status === "unregistered") {
    return (
      <Message
        title={decoded}
        body="This name has never been registered — there is nothing to renew yet."
        link={{
          href: `https://bns.one/register?search=${encodeURIComponent(parsed.name)}`,
          label: "→ register it on BNS One",
        }}
      />
    );
  }
  if (state.isManaged) {
    return (
      <Message
        title={decoded}
        body={`.${state.namespace} is a manager-controlled namespace — renewals happen through its own app, not the BNS-V2 contract.`}
      />
    );
  }

  const meta = STATUS_META[state.status];
  const expiry = describeExpiry(state.renewalHeight, state.currentBurnBlock);
  const priceStx = (Number(priceUstx) / 1_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });

  return (
    <div className="py-20">
      <p className="rise rise-1 font-mono text-[13px] tracking-[0.25em] text-washi-dim uppercase">
        one-tap renewal
      </p>
      <div className="rise rise-2 mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <h1 className="font-display text-4xl break-all text-washi md:text-5xl">{decoded}</h1>
        <span className={`border px-3 py-1 font-mono text-xs ${meta.className}`}>{meta.label}</span>
      </div>

      <dl className="rise rise-3 mt-10 grid max-w-2xl gap-x-10 gap-y-6 border border-ink-line bg-ink-raised/40 p-6 font-mono text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">
            {state.status === "active" ? "expires" : "grace ends / expired"}
          </dt>
          <dd className="mt-1 text-washi">{expiry ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-washi-dim uppercase">renewal burns</dt>
          <dd className="mt-1 text-washi">
            {priceStx} STX
            <span className="text-washi-dim"> (enforced by post-condition)</span>
          </dd>
        </div>
      </dl>

      <div className="rise rise-4 mt-8 max-w-2xl">
        <EmberBar
          renewalHeight={state.renewalHeight}
          currentBurnBlock={state.currentBurnBlock}
          status={state.status}
        />
      </div>

      <div className="rise rise-5 mt-12">
        <RenewButton
          contractId={BNS_V2_CONTRACT_ID}
          name={parsed.name}
          namespace={parsed.namespace}
          priceUstx={priceUstx.toString()}
        />
      </div>

      <p className="mt-10 max-w-xl font-mono text-xs leading-relaxed text-washi-dim">
        Your wallet opens with the BNS-V2 <code>name-renewal</code> call
        pre-filled. The transaction is set to deny mode with a post-condition
        of exactly {priceStx} STX — if the contract tried to take more, the
        chain would reject it. Renewing extends the name by its namespace
        lifetime; you can renew early without losing time.{" "}
        <Link className="underline underline-offset-4" href={`/name/${encodeURIComponent(decoded)}`}>
          Full status →
        </Link>
      </p>
    </div>
  );
}

function Message({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="py-24">
      <h1 className="font-display text-3xl break-all text-washi">{title}</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-washi-dim">{body}</p>
      {link && (
        <a
          href={link.href}
          className="mt-8 inline-block border border-shu bg-shu px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
        >
          {link.label}
        </a>
      )}
    </div>
  );
}
