"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  describeExpiry,
  expiryTone,
  STATUS_META,
  truncateAddress,
} from "@/lib/format";
import type { DashboardName } from "../api/names/[address]/route";

/**
 * Wallet-connected dashboard: your names, their countdowns, renew buttons.
 * Identity is the connected wallet (read-only — no accounts, no signatures).
 * Recurring alerts are managed through the Telegram bot; the deep-link
 * pre-fills /address with the connected wallet.
 */

interface Props {
  botUrl: string | null;
}

type WalletState =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | { kind: "connected"; address: string };

type NamesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; currentBurnBlock: number; names: DashboardName[] }
  | { kind: "error"; message: string };

const TONE_CLASS = {
  calm: "text-washi-dim",
  warn: "text-amber",
  urgent: "text-shu",
} as const;

export function DashboardClient({ botUrl }: Props) {
  const [wallet, setWallet] = useState<WalletState>({ kind: "loading" });
  const [names, setNames] = useState<NamesState>({ kind: "idle" });

  // Restore a previous session from @stacks/connect local storage.
  useEffect(() => {
    void (async () => {
      const connect = await import("@stacks/connect");
      const address = connect.isConnected()
        ? connect.getLocalStorage()?.addresses?.stx?.[0]?.address
        : undefined;
      setWallet(address ? { kind: "connected", address } : { kind: "disconnected" });
    })();
  }, []);

  const loadNames = useCallback(async (address: string) => {
    setNames({ kind: "loading" });
    try {
      const response = await fetch(`/api/names/${address}`);
      if (!response.ok) throw new Error((await response.json()).error ?? "failed");
      const data = await response.json();
      setNames({ kind: "loaded", ...data });
    } catch (error) {
      setNames({
        kind: "error",
        message: error instanceof Error ? error.message : "failed to load names",
      });
    }
  }, []);

  useEffect(() => {
    if (wallet.kind === "connected") void loadNames(wallet.address);
  }, [wallet, loadNames]);

  async function connectWallet() {
    const connect = await import("@stacks/connect");
    try {
      const response = await connect.connect();
      const address = response.addresses.find((a) => a.address.startsWith("S"))?.address;
      if (address) setWallet({ kind: "connected", address });
    } catch {
      /* user closed the wallet popup — stay disconnected */
    }
  }

  async function disconnectWallet() {
    const connect = await import("@stacks/connect");
    connect.disconnect();
    setWallet({ kind: "disconnected" });
    setNames({ kind: "idle" });
  }

  if (wallet.kind === "loading") {
    return <p className="font-mono text-sm text-washi-dim">checking wallet…</p>;
  }

  if (wallet.kind === "disconnected") {
    return (
      <div className="border border-ink-line p-10 text-center">
        <p className="mx-auto max-w-md text-sm leading-relaxed text-washi-dim">
          Connect a Stacks wallet (Leather, Xverse, …) to see every BNS name
          you own with live expiry countdowns and one-tap renewal.
        </p>
        <button
          onClick={connectWallet}
          className="mt-8 border border-shu bg-shu px-8 py-3 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu"
        >
          → connect wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-line pb-6">
        <div className="font-mono text-sm">
          <span className="text-washi-dim">connected · </span>
          <span title={wallet.address}>{truncateAddress(wallet.address)}</span>
        </div>
        <div className="flex gap-4 font-mono text-xs">
          {botUrl && (
            <a
              href={`${botUrl}?start=address-${wallet.address}`}
              className="border border-ink-line px-4 py-2 text-washi-dim transition-colors hover:border-washi-dim hover:text-washi"
            >
              get alerts for this wallet →
            </a>
          )}
          <button
            onClick={disconnectWallet}
            className="text-washi-dim underline-offset-4 hover:underline"
          >
            disconnect
          </button>
        </div>
      </div>

      {names.kind === "loading" && (
        <p className="mt-10 font-mono text-sm text-washi-dim">reading the chain…</p>
      )}
      {names.kind === "error" && (
        <p className="mt-10 font-mono text-sm text-shu">
          {names.message}{" "}
          <button className="underline underline-offset-4" onClick={() => loadNames(wallet.address)}>
            retry
          </button>
        </p>
      )}
      {names.kind === "loaded" && names.names.length === 0 && (
        <p className="mt-10 font-mono text-sm text-washi-dim">
          This address owns no BNS names.{" "}
          <a className="underline underline-offset-4" href="https://bns.one/register">
            Register one on BNS One →
          </a>
        </p>
      )}
      {names.kind === "loaded" && names.names.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-line">
          {names.names.map((name) => {
            const meta = STATUS_META[name.status];
            const tone = expiryTone(name.renewalHeight, names.currentBurnBlock);
            const expiry =
              name.status === "nonexpiring"
                ? "never expires"
                : (describeExpiry(name.renewalHeight, names.currentBurnBlock) ?? "—");
            const renewable = name.status === "active" || name.status === "grace";
            return (
              <li key={name.fqn} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5">
                <Link
                  href={`/name/${encodeURIComponent(name.fqn)}`}
                  className="min-w-48 font-display text-xl break-all text-washi hover:text-shu"
                >
                  {name.fqn}
                </Link>
                <span className={`border px-2 py-0.5 font-mono text-[11px] ${meta.className}`}>
                  {meta.label}
                </span>
                <span className={`font-mono text-xs ${TONE_CLASS[tone]}`}>{expiry}</span>
                {renewable && (
                  <Link
                    href={`/renew/${encodeURIComponent(name.fqn)}`}
                    className="ml-auto border border-shu px-4 py-1.5 font-mono text-xs text-shu transition-colors hover:bg-shu hover:text-ink"
                  >
                    renew →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
