"use client";

import { useState } from "react";

/**
 * The one-tap renewal action. Opens the user's Stacks wallet (Leather,
 * Xverse, … via @stacks/connect) with the BNS-V2 `name-renewal` call
 * pre-filled and a deny-mode post-condition pinning the STX burn to the
 * exact on-chain price — the wallet will refuse anything else.
 *
 * Heavy Stacks libraries are imported on click, keeping the page light.
 */

interface Props {
  contractId: string;
  name: string;
  namespace: string;
  /** Renewal price in micro-STX, stringified bigint from the server. */
  priceUstx: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "signing" }
  | { kind: "submitted"; txid: string }
  | { kind: "error"; message: string };

export function RenewButton({ contractId, name, namespace, priceUstx }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function renew() {
    try {
      setPhase({ kind: "connecting" });
      const connect = await import("@stacks/connect");
      const { Cl, Pc } = await import("@stacks/transactions");

      if (!connect.isConnected()) await connect.connect();
      const stored = connect.getLocalStorage();
      const sender = stored?.addresses?.stx?.[0]?.address;
      if (!sender) throw new Error("No Stacks address available from the wallet.");

      setPhase({ kind: "signing" });
      const response = await connect.request("stx_callContract", {
        contract: contractId as `${string}.${string}`,
        functionName: "name-renewal",
        // Contract signature: (name-renewal (namespace (buff 20)) (name (buff 48)))
        functionArgs: [Cl.bufferFromAscii(namespace), Cl.bufferFromAscii(name)],
        network: "mainnet",
        // The contract burns exactly get-name-price from the caller; pin it.
        postConditions: [Pc.principal(sender).willSendEq(BigInt(priceUstx)).ustx()],
        postConditionMode: "deny",
      });
      setPhase({ kind: "submitted", txid: response.txid ?? "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPhase({
        kind: "error",
        message: /cancel|reject|denied|closed/i.test(message)
          ? "Wallet request cancelled."
          : message,
      });
    }
  }

  if (phase.kind === "submitted") {
    return (
      <div className="border border-moss/40 px-6 py-4 font-mono text-sm text-moss">
        Renewal submitted.
        {phase.txid && (
          <>
            {" "}
            <a
              className="underline underline-offset-4"
              href={`https://explorer.hiro.so/txid/${phase.txid}?chain=mainnet`}
            >
              View on the explorer →
            </a>
          </>
        )}
      </div>
    );
  }

  const busy = phase.kind === "connecting" || phase.kind === "signing";
  return (
    <div>
      <button
        onClick={renew}
        disabled={busy}
        className="border border-shu bg-shu px-8 py-4 font-mono text-sm text-ink transition-colors hover:bg-transparent hover:text-shu disabled:cursor-wait disabled:opacity-60"
      >
        {phase.kind === "connecting"
          ? "connecting wallet…"
          : phase.kind === "signing"
            ? "confirm in your wallet…"
            : `→ renew ${name}.${namespace}`}
      </button>
      {phase.kind === "error" && (
        <p className="mt-4 font-mono text-xs text-shu">{phase.message}</p>
      )}
    </div>
  );
}
