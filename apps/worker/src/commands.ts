import {
  estimateBurnBlockDate,
  formatApproxBlocks,
  splitFqn,
  type NameState,
} from "@yagura/core";
import {
  nameState,
  trackedAddresses,
  trackedNames,
  users,
  type YaguraDb,
} from "@yagura/core/db";
import { and, eq, inArray } from "drizzle-orm";

import type { EmailProvider } from "./email.js";
import { renderVerificationEmail } from "./messages.js";
import type { BnsReader } from "./poller.js";

/**
 * Telegram command logic, separated from grammY wiring so every handler is
 * a plain async function over the database — directly unit-testable, and
 * reusable if another chat frontend ever appears.
 *
 * Reply strings are intentionally terse: this bot is a tool, not a chatbot.
 */

/** Mainnet standard/contract principals: S + P/M + c32 alphabet (no I/L/O/U). */
const STACKS_ADDRESS_RE = /^S[PM][0-9A-HJKMNP-TV-Z]{35,45}$/;

type UserRow = typeof users.$inferSelect;

/** Find or create the user behind a Telegram chat, reviving a dead channel on contact. */
export async function ensureUser(
  db: YaguraDb,
  chatId: string,
): Promise<UserRow> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId));
  if (existing[0]) {
    if (!existing[0].telegramActive) {
      // The user talked to us again — the channel is alive after all.
      await db
        .update(users)
        .set({ telegramActive: true })
        .where(eq(users.id, existing[0].id));
      existing[0].telegramActive = true;
    }
    return existing[0];
  }
  const [created] = await db
    .insert(users)
    .values({ telegramChatId: chatId })
    .returning();
  return created!;
}

export const START_TEXT =
  "Yagura — the watchtower for your BNS names.\n\n" +
  "/address SP… — monitor an address: expiry alerts for every name it owns\n" +
  "/track name.btc — track one name (auto-detects own vs want)\n" +
  "/watch name.btc — alert when a name becomes available to claim\n" +
  "/status name.btc — instant on-chain lookup\n" +
  "/list — everything you track\n" +
  "/untrack name.btc — stop tracking a name\n" +
  "/email you@example.com — add email alerts (/verify CODE to confirm)";

export async function cmdAddress(
  db: YaguraDb,
  user: UserRow,
  input: string,
): Promise<string> {
  const address = input.trim().toUpperCase();
  if (!STACKS_ADDRESS_RE.test(address)) {
    return "That doesn't look like a Stacks address (expected SP…).";
  }
  await db
    .insert(trackedAddresses)
    .values({ userId: user.id, stacksAddress: address })
    .onConflictDoNothing();
  return `Watching ${address}. Every name it owns gets expiry alerts (picked up on the next poll, within ~10 min).`;
}

/** Outcome of /track: either tracked directly, or the bot must ask own-vs-want. */
export type TrackOutcome =
  | { kind: "done"; reply: string }
  | { kind: "ask"; fqn: string; reply: string };

export async function cmdTrack(
  db: YaguraDb,
  bns: BnsReader,
  user: UserRow,
  input: string,
): Promise<TrackOutcome> {
  let fqn: string;
  try {
    const parts = splitFqn(input);
    fqn = `${parts.name}.${parts.namespace}`;
  } catch {
    return { kind: "done", reply: "Usage: /track name.namespace (e.g. /track satoshi.btc)" };
  }

  let state: NameState;
  try {
    state = await bns.resolveName(fqn);
  } catch {
    return { kind: "done", reply: `Couldn't reach the chain for ${fqn} — try again in a minute.` };
  }

  if (state.status === "unregistered") {
    await trackAs(db, user, fqn, "want");
    return {
      kind: "done",
      reply: `${fqn} isn't registered. Watching it for you — you'll hear the moment it's claimable.`,
    };
  }

  const owned = await db
    .select()
    .from(trackedAddresses)
    .where(eq(trackedAddresses.userId, user.id));
  if (state.owner && owned.some((a) => a.stacksAddress === state.owner)) {
    await trackAs(db, user, fqn, "own");
    return {
      kind: "done",
      reply: `${fqn} is yours — expiry alerts on.`,
    };
  }

  return {
    kind: "ask",
    fqn,
    reply: `${fqn} is owned by ${state.owner ?? "someone else"}. Track it as…`,
  };
}

export async function trackAs(
  db: YaguraDb,
  user: UserRow,
  fqn: string,
  mode: "own" | "want",
): Promise<string> {
  await db
    .insert(trackedNames)
    .values({ userId: user.id, fqn, mode })
    .onConflictDoNothing();
  return mode === "own"
    ? `${fqn}: expiry alerts on.`
    : `${fqn}: availability watch on.`;
}

export async function cmdUntrack(
  db: YaguraDb,
  user: UserRow,
  input: string,
): Promise<string> {
  const fqn = input.trim().toLowerCase();
  const rows = await db
    .select()
    .from(trackedNames)
    .where(and(eq(trackedNames.userId, user.id), eq(trackedNames.fqn, fqn)));
  if (rows.length === 0) return `You aren't tracking ${fqn}.`;
  await db
    .delete(trackedNames)
    .where(and(eq(trackedNames.userId, user.id), eq(trackedNames.fqn, fqn)));
  if (rows[0]!.source === "discovered") {
    return `Stopped tracking ${fqn}. Note: it was auto-discovered from a tracked address — it will come back unless you untrack the address too.`;
  }
  return `Stopped tracking ${fqn}.`;
}

export async function cmdList(db: YaguraDb, user: UserRow): Promise<string> {
  const addresses = await db
    .select()
    .from(trackedAddresses)
    .where(eq(trackedAddresses.userId, user.id));
  const names = await db
    .select()
    .from(trackedNames)
    .where(and(eq(trackedNames.userId, user.id), eq(trackedNames.active, true)));

  if (addresses.length === 0 && names.length === 0) {
    return "You aren't tracking anything yet. /address SP… or /track name.btc to begin.";
  }

  const states = new Map<string, typeof nameState.$inferSelect>();
  if (names.length > 0) {
    const rows = await db
      .select()
      .from(nameState)
      .where(inArray(nameState.fqn, names.map((n) => n.fqn)));
    for (const row of rows) states.set(row.fqn, row);
  }

  const lines: string[] = [];
  for (const address of addresses) {
    lines.push(`📍 ${address.stacksAddress}`);
  }
  for (const tracked of names) {
    const state = states.get(tracked.fqn);
    const tag = tracked.mode === "own" ? "🛡" : "👁";
    if (!state) {
      lines.push(`${tag} ${tracked.fqn} — checking…`);
    } else if (state.renewalHeight !== null && state.status !== "nonexpiring") {
      const left = state.renewalHeight - state.currentBurnBlock;
      lines.push(
        `${tag} ${tracked.fqn} — ${state.status}, ${left >= 0 ? `expires in ${formatApproxBlocks(left)}` : `expired ${formatApproxBlocks(left)} ago`}`,
      );
    } else {
      lines.push(`${tag} ${tracked.fqn} — ${state.status}`);
    }
  }
  return lines.join("\n");
}

export async function cmdStatus(bns: BnsReader, input: string): Promise<string> {
  let fqn: string;
  try {
    const parts = splitFqn(input);
    fqn = `${parts.name}.${parts.namespace}`;
  } catch {
    return "Usage: /status name.namespace";
  }
  let state: NameState;
  try {
    state = await bns.resolveName(fqn);
  } catch {
    return `Couldn't reach the chain for ${fqn} — try again in a minute.`;
  }
  const lines = [`${fqn}: ${state.status}`];
  if (state.owner) lines.push(`owner: ${state.owner}`);
  if (state.renewalHeight !== null) {
    const left = state.renewalHeight - state.currentBurnBlock;
    const estimate = estimateBurnBlockDate(state.renewalHeight, state.currentBurnBlock);
    lines.push(
      left >= 0
        ? `expires in ${formatApproxBlocks(left)} (~${estimate.toISOString().slice(0, 10)})`
        : `renewal height passed ${formatApproxBlocks(left)} ago`,
    );
  }
  if (state.status === "nonexpiring") lines.push("this name never expires");
  return lines.join("\n");
}

/** /email — store the address unverified and send a 6-digit code. */
export async function cmdEmail(
  db: YaguraDb,
  email: EmailProvider,
  user: UserRow,
  input: string,
): Promise<string> {
  const address = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return "That doesn't look like an email address.";
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db
    .update(users)
    .set({
      email: address,
      emailVerified: false,
      emailActive: true,
      emailVerifyCode: code,
      emailVerifyExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    .where(eq(users.id, user.id));
  const rendered = renderVerificationEmail(code);
  const result = await email.send({
    to: address,
    subject: rendered.subject,
    text: rendered.text,
  });
  if (result !== "sent") {
    return "Couldn't send the verification email — check the address and try again.";
  }
  return `Verification code sent to ${address}. Reply /verify CODE to confirm.`;
}

export async function cmdVerify(
  db: YaguraDb,
  user: UserRow,
  input: string,
): Promise<string> {
  const code = input.trim();
  if (!user.email || !user.emailVerifyCode) {
    return "No verification pending. /email you@example.com first.";
  }
  if (
    user.emailVerifyExpiresAt === null ||
    user.emailVerifyExpiresAt.getTime() < Date.now()
  ) {
    return "That code expired. /email again for a fresh one.";
  }
  if (code !== user.emailVerifyCode) return "Wrong code.";
  await db
    .update(users)
    .set({ emailVerified: true, emailVerifyCode: null, emailVerifyExpiresAt: null })
    .where(eq(users.id, user.id));
  return `${user.email} verified — email alerts on.`;
}
