import {
  computeDueOwnAlerts,
  computeDueWantAlerts,
  estimateBurnBlockDate,
  mostUrgent,
  type AlertTier,
  type BnsReader,
  type NameState,
  type OwnedName,
} from "@yagura/core";
import {
  alertsSent,
  nameState,
  trackedAddresses,
  trackedNames,
  type YaguraDb,
} from "@yagura/core/db";
import { and, eq, inArray } from "drizzle-orm";

import { mapLimit } from "./util.js";

/**
 * One poll cycle — the heartbeat of the watchtower. Every N minutes:
 *
 *  1. Discovery: for each tracked address, list the names it owns and
 *     auto-track them in 'own' mode.
 *  2. Refresh: resolve every actively tracked name and upsert `name_state`.
 *  3. Ownership: names whose owner changed away from the tracking user get a
 *     one-time "you no longer own X" alert and stop producing expiry alerts.
 *  4. Alerts: run the pure tier rules against the `alerts_sent` ledger and
 *     enqueue whatever is newly due (unique index = race-proof idempotency).
 *
 * Failure policy: any fetch failure means "no new information" — the name
 * keeps its previous state and produces no alerts this cycle. Nothing is
 * ever marked available (or unowned) off the back of an error.
 */

export type { BnsReader };

export interface PollOptions {
  /** Max in-flight API requests (politeness toward public rate limits). */
  concurrency?: number;
  log?: (message: string) => void;
}

export interface PollStats {
  addressesPolled: number;
  addressFailures: number;
  namesResolved: number;
  nameFailures: number;
  alertsEnqueued: number;
  alertsSuppressed: number;
  ownershipChanges: number;
}

export async function runPollCycle(
  db: YaguraDb,
  bns: BnsReader,
  options: PollOptions = {},
): Promise<PollStats> {
  const { concurrency = 4, log = () => {} } = options;
  const stats: PollStats = {
    addressesPolled: 0,
    addressFailures: 0,
    namesResolved: 0,
    nameFailures: 0,
    alertsEnqueued: 0,
    alertsSuppressed: 0,
    ownershipChanges: 0,
  };

  // ── 1. Discovery: auto-track every name owned by a tracked address ──────
  const addressRows = await db.select().from(trackedAddresses);
  const addressesByUser = new Map<string, string[]>();
  for (const row of addressRows) {
    const list = addressesByUser.get(row.userId) ?? [];
    list.push(row.stacksAddress);
    addressesByUser.set(row.userId, list);
  }

  await mapLimit(addressRows, concurrency, async (row) => {
    stats.addressesPolled++;
    let owned: OwnedName[];
    try {
      owned = await bns.listNamesOwnedBy(row.stacksAddress);
    } catch (error) {
      stats.addressFailures++;
      log(`discovery failed for ${row.stacksAddress}: ${String(error)}`);
      return;
    }
    for (const name of owned) {
      await db
        .insert(trackedNames)
        .values({
          userId: row.userId,
          fqn: name.fqn,
          mode: "own",
          source: "discovered",
        })
        .onConflictDoNothing();
    }
  });

  // ── 2. Refresh state for every actively tracked name ────────────────────
  const tracked = await db
    .select()
    .from(trackedNames)
    .where(eq(trackedNames.active, true));
  const fqns = [...new Set(tracked.map((t) => t.fqn))];

  const prevOwners = new Map<string, string | null>();
  if (fqns.length > 0) {
    const prevRows = await db
      .select({ fqn: nameState.fqn, owner: nameState.owner })
      .from(nameState)
      .where(inArray(nameState.fqn, fqns));
    for (const row of prevRows) prevOwners.set(row.fqn, row.owner);
  }

  const freshStates = new Map<string, NameState>();
  await mapLimit(fqns, concurrency, async (fqn) => {
    let state: NameState;
    try {
      state = await bns.resolveName(fqn);
    } catch (error) {
      stats.nameFailures++;
      log(`resolve failed for ${fqn}: ${String(error)} — keeping last state`);
      return;
    }
    stats.namesResolved++;
    freshStates.set(fqn, state);
    await db
      .insert(nameState)
      .values({
        fqn: state.fqn,
        name: state.name,
        namespace: state.namespace,
        owner: state.owner,
        renewalHeight: state.renewalHeight,
        lifetime: state.lifetime,
        status: state.status,
        isManaged: state.isManaged,
        currentBurnBlock: state.currentBurnBlock,
        lastCheckedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nameState.fqn,
        set: {
          owner: state.owner,
          renewalHeight: state.renewalHeight,
          lifetime: state.lifetime,
          status: state.status,
          isManaged: state.isManaged,
          currentBurnBlock: state.currentBurnBlock,
          lastCheckedAt: new Date(),
        },
      });
  });

  // ── 3. Ownership changes: alert once, then stop expiry alerts ───────────
  // A change only counts when we saw a previous owner AND a fresh, different,
  // non-null owner this cycle. If the new owner is another address the same
  // user tracks, it just moved between their wallets — not a loss.
  const deactivated = new Set<string>(); // `${userId}:${fqn}`
  for (const row of tracked) {
    if (row.mode !== "own") continue;
    const fresh = freshStates.get(row.fqn);
    const prevOwner = prevOwners.get(row.fqn);
    if (!fresh || !fresh.owner || !prevOwner || fresh.owner === prevOwner) {
      continue;
    }
    const userAddresses = addressesByUser.get(row.userId) ?? [];
    if (userAddresses.includes(fresh.owner)) continue;

    const inserted = await enqueueAlerts(db, {
      userId: row.userId,
      fqn: row.fqn,
      due: ["owner-changed"],
      fire: "owner-changed",
      state: fresh,
    });
    stats.alertsEnqueued += inserted.fired;
    stats.ownershipChanges++;
    await db
      .update(trackedNames)
      .set({ active: false })
      .where(eq(trackedNames.id, row.id));
    deactivated.add(`${row.userId}:${row.fqn}`);
    log(`owner changed for ${row.fqn}: ${prevOwner} → ${fresh.owner}`);
  }

  // ── 4. Alert tiers due this cycle ───────────────────────────────────────
  for (const row of tracked) {
    if (deactivated.has(`${row.userId}:${row.fqn}`)) continue;
    const state = freshStates.get(row.fqn);
    if (!state) continue; // fetch failed → no new information → no alerts

    const sentRows = await db
      .select({ alertType: alertsSent.alertType })
      .from(alertsSent)
      .where(
        and(eq(alertsSent.userId, row.userId), eq(alertsSent.fqn, row.fqn)),
      );
    const already = new Set<AlertTier>(sentRows.map((r) => r.alertType));

    const inputs = {
      status: state.status,
      renewalHeight: state.renewalHeight,
      currentBurnBlock: state.currentBurnBlock,
    };
    const due =
      row.mode === "own"
        ? computeDueOwnAlerts(inputs, already)
        : computeDueWantAlerts(inputs, already);
    if (due.length === 0) continue;

    const inserted = await enqueueAlerts(db, {
      userId: row.userId,
      fqn: row.fqn,
      due,
      fire: mostUrgent(due),
      state,
    });
    stats.alertsEnqueued += inserted.fired;
    stats.alertsSuppressed += inserted.suppressed;
  }

  return stats;
}

/**
 * Record due alert tiers in the ledger. Only `fire` is deliverable; the rest
 * are written as suppressed so they can never mature again. onConflictDoNothing
 * against the unique (user, fqn, type) index makes this safe to race.
 */
async function enqueueAlerts(
  db: YaguraDb,
  args: {
    userId: string;
    fqn: string;
    due: AlertTier[];
    fire: AlertTier | null;
    state: NameState;
  },
): Promise<{ fired: number; suppressed: number }> {
  const { userId, fqn, due, fire, state } = args;
  const payload = {
    fqn,
    status: state.status,
    renewalHeight: state.renewalHeight,
    currentBurnBlock: state.currentBurnBlock,
    expiryEstimateIso:
      state.renewalHeight !== null
        ? estimateBurnBlockDate(
            state.renewalHeight,
            state.currentBurnBlock,
          ).toISOString()
        : null,
  };
  let fired = 0;
  let suppressed = 0;
  for (const tier of due) {
    const rows = await db
      .insert(alertsSent)
      .values({
        userId,
        fqn,
        alertType: tier,
        suppressed: tier !== fire,
        payload,
      })
      .onConflictDoNothing()
      .returning({ id: alertsSent.id });
    if (rows.length > 0) {
      if (tier === fire) fired++;
      else suppressed++;
    }
  }
  return { fired, suppressed };
}
