import {
  BURN_BLOCKS_PER_DAY,
  NAME_GRACE_PERIOD_BLOCKS,
} from "./constants.js";
import type { NameStatus } from "./types.js";

/**
 * Alert scheduling rules.
 *
 * Pure functions only: given a name's current state and the set of alert
 * tiers already sent to this user for this name, decide what (if anything)
 * is due now. The worker owns persistence and delivery; keeping the decision
 * logic pure makes it trivially unit-testable and impossible to double-send
 * as long as the caller records what it sent.
 */

/** Every alert tier Yagura can send, per (user, name). Each fires at most once. */
export type AlertTier =
  | "expiry-30d" // 'own': ~30 days before renewal height
  | "expiry-7d" // 'own': ~7 days before
  | "expiry-1d" // 'own': ~1 day before
  | "grace-started" // 'own': renewal height passed, grace period running
  | "grace-half" // 'own': halfway through grace — last calm warning
  | "available" // 'want': name is acquirable right now
  | "owner-changed"; // 'own': the tracked address no longer owns this name

/** Pre-expiry warning tiers, ordered least → most urgent. */
const EXPIRY_TIERS: ReadonlyArray<{
  tier: AlertTier;
  blocksBefore: number;
}> = [
  { tier: "expiry-30d", blocksBefore: 30 * BURN_BLOCKS_PER_DAY },
  { tier: "expiry-7d", blocksBefore: 7 * BURN_BLOCKS_PER_DAY },
  { tier: "expiry-1d", blocksBefore: 1 * BURN_BLOCKS_PER_DAY },
];

export interface AlertInputs {
  status: NameStatus;
  /** Effective renewal height, or null when not applicable/provable. */
  renewalHeight: number | null;
  currentBurnBlock: number;
}

/**
 * Alerts due for a name tracked in 'own' (defensive) mode.
 *
 * Returns every matured, not-yet-sent tier ordered least → most urgent. When
 * a name is first tracked deep into the warning window (say 3 days left),
 * several tiers mature at once; the worker should DELIVER only the last
 * (most urgent) entry and record all returned tiers as sent, so the user gets
 * one message, not three stale ones.
 *
 * `nonexpiring`, `unregistered`, and `unknown` states never produce alerts.
 */
export function computeDueOwnAlerts(
  inputs: AlertInputs,
  alreadySent: ReadonlySet<AlertTier>,
): AlertTier[] {
  const { status, renewalHeight, currentBurnBlock } = inputs;
  const due: AlertTier[] = [];
  if (renewalHeight === null) return due;

  if (status === "active") {
    const blocksLeft = renewalHeight - currentBurnBlock;
    for (const { tier, blocksBefore } of EXPIRY_TIERS) {
      if (blocksLeft <= blocksBefore && !alreadySent.has(tier)) due.push(tier);
    }
    return due;
  }

  if (status === "grace" || status === "available") {
    // Once grace begins, the pre-expiry countdown tiers are moot — mark them
    // matured too so a late-tracked name doesn't emit obsolete warnings.
    for (const { tier } of EXPIRY_TIERS) {
      if (!alreadySent.has(tier)) due.push(tier);
    }
    if (!alreadySent.has("grace-started")) due.push("grace-started");
    const halfGrace = renewalHeight + NAME_GRACE_PERIOD_BLOCKS / 2;
    if (currentBurnBlock >= halfGrace && !alreadySent.has("grace-half")) {
      due.push("grace-half");
    }
  }

  return due;
}

/**
 * Alerts due for a name tracked in 'want' (availability watch) mode.
 *
 * Fires only on a DEFINITIVE `available` (or `unregistered`, which is also
 * registrable) status — never on `unknown` or on any fetch ambiguity. A false
 * "it's free!" ping would destroy user trust, so precision beats recall here.
 */
export function computeDueWantAlerts(
  inputs: Pick<AlertInputs, "status">,
  alreadySent: ReadonlySet<AlertTier>,
): AlertTier[] {
  const acquirable =
    inputs.status === "available" || inputs.status === "unregistered";
  if (acquirable && !alreadySent.has("available")) return ["available"];
  return [];
}

/** The single tier the worker should actually deliver from a due list. */
export function mostUrgent(due: AlertTier[]): AlertTier | null {
  return due.length > 0 ? due[due.length - 1]! : null;
}
