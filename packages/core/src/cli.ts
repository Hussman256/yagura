#!/usr/bin/env tsx
/**
 * Tiny manual-verification CLI for the core BNS client, run from the repo
 * root against live mainnet:
 *
 *   pnpm bns status muneeb.btc     — full state of one name
 *   pnpm bns names SP3...          — names owned by an address
 *   pnpm bns price muneeb.btc      — renewal price in STX
 *
 * This is a developer tool, not a user surface — output is plain text.
 */
import {
  estimateBurnBlockDate,
  formatApproxBlocks,
} from "./block-time.js";
import { YaguraBnsClient } from "./bns-client.js";

const client = new YaguraBnsClient({
  bnsApi: process.env["YAGURA_BNSV2_API_BASE"]
    ? { baseUrl: process.env["YAGURA_BNSV2_API_BASE"] }
    : {},
  hiro: {
    ...(process.env["YAGURA_HIRO_API_BASE"]
      ? { baseUrl: process.env["YAGURA_HIRO_API_BASE"] }
      : {}),
    ...(process.env["YAGURA_HIRO_API_KEY"]
      ? { apiKey: process.env["YAGURA_HIRO_API_KEY"] }
      : {}),
  },
});

async function status(fqn: string): Promise<void> {
  const state = await client.resolveName(fqn);
  console.log(`name:            ${state.fqn}`);
  console.log(`status:          ${state.status}`);
  console.log(`owner:           ${state.owner ?? "—"}`);
  console.log(
    `lifetime:        ${state.lifetime === 0 ? "∞ (never expires)" : `${state.lifetime} burn blocks`}`,
  );
  console.log(`managed ns:      ${state.isManaged ? "yes" : "no"}`);
  console.log(`burn height now: ${state.currentBurnBlock}`);
  if (state.renewalHeight !== null) {
    const delta = state.renewalHeight - state.currentBurnBlock;
    const when = estimateBurnBlockDate(
      state.renewalHeight,
      state.currentBurnBlock,
    );
    console.log(`renewal height:  ${state.renewalHeight}`);
    console.log(
      `expiry estimate: ${when.toISOString().slice(0, 10)} (${formatApproxBlocks(delta)} ${delta >= 0 ? "from now" : "ago"}, assuming 10 min/block)`,
    );
  }
}

async function names(address: string): Promise<void> {
  const owned = await client.listNamesOwnedBy(address);
  if (owned.length === 0) {
    console.log("no valid names owned by this address");
    return;
  }
  for (const entry of owned) {
    console.log(
      `${entry.fqn.padEnd(32)} renewal height: ${entry.renewalHeight ?? "∞"}`,
    );
  }
}

async function price(fqn: string): Promise<void> {
  const ustx = await client.getRenewalPriceUstx(fqn);
  console.log(`${fqn}: ${ustx} µSTX (${Number(ustx) / 1_000_000} STX) burned on renewal`);
}

const [command, argument] = process.argv.slice(2);
const usage = "usage: pnpm bns <status|names|price> <name.namespace|SP-address>";

try {
  if (!argument) throw new Error(usage);
  if (command === "status") await status(argument);
  else if (command === "names") await names(argument);
  else if (command === "price") await price(argument);
  else throw new Error(usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
