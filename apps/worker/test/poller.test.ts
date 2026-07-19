import type { NameState, OwnedName } from "@yagura/core";
import {
  alertsSent,
  createDb,
  nameState,
  trackedAddresses,
  trackedNames,
  users,
  type YaguraDbHandle,
} from "@yagura/core/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPollCycle, type BnsReader } from "../src/poller.js";

/**
 * Poller integration tests against a real (in-process, in-memory) Postgres
 * via PGlite, with a scripted BNS reader — no network, real SQL.
 */

const OWNER_A = "SP1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const OWNER_B = "SP2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** Scriptable fake: set per-name states and per-address listings; throw on demand. */
class FakeBns implements BnsReader {
  states = new Map<string, NameState>();
  listings = new Map<string, OwnedName[]>();
  failResolves = new Set<string>();
  failListings = new Set<string>();

  async resolveName(fqn: string): Promise<NameState> {
    if (this.failResolves.has(fqn)) throw new Error(`fake outage for ${fqn}`);
    const state = this.states.get(fqn);
    if (!state) throw new Error(`no scripted state for ${fqn}`);
    return state;
  }

  async listNamesOwnedBy(address: string): Promise<OwnedName[]> {
    if (this.failListings.has(address)) {
      throw new Error(`fake outage for ${address}`);
    }
    return this.listings.get(address) ?? [];
  }
}

function makeState(overrides: Partial<NameState> & { fqn: string }): NameState {
  const [name = "", namespace = ""] = [
    overrides.fqn.split(".")[0],
    overrides.fqn.split(".")[1],
  ];
  return {
    name,
    namespace,
    owner: OWNER_A,
    renewalHeight: 1_000_000,
    lifetime: 262_800,
    status: "active",
    currentBurnBlock: 900_000,
    isManaged: false,
    ...overrides,
  };
}

let handle: YaguraDbHandle;
let bns: FakeBns;

beforeEach(async () => {
  handle = await createDb("pglite://memory");
  await handle.migrate();
  bns = new FakeBns();
});

afterEach(async () => {
  await handle.close();
});

async function makeUser(): Promise<string> {
  const [row] = await handle.db.insert(users).values({}).returning();
  return row!.id;
}

async function alertsFor(userId: string) {
  return handle.db
    .select()
    .from(alertsSent)
    .where(eq(alertsSent.userId, userId))
    .orderBy(alertsSent.alertType);
}

describe("discovery", () => {
  it("auto-tracks names owned by a tracked address and records their state", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedAddresses)
      .values({ userId, stacksAddress: OWNER_A });
    bns.listings.set(OWNER_A, [
      { fqn: "alpha.btc", name: "alpha", namespace: "btc", renewalHeight: 1_000_000 },
    ]);
    bns.states.set("alpha.btc", makeState({ fqn: "alpha.btc" }));

    const stats = await runPollCycle(handle.db, bns);

    const tracked = await handle.db.select().from(trackedNames);
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toMatchObject({
      fqn: "alpha.btc",
      mode: "own",
      source: "discovered",
      active: true,
    });
    const states = await handle.db.select().from(nameState);
    expect(states[0]).toMatchObject({ fqn: "alpha.btc", status: "active" });
    expect(stats.namesResolved).toBe(1);
    // Far from expiry → nothing due.
    expect(await alertsFor(userId)).toHaveLength(0);
  });

  it("keeps everything untouched when discovery fails", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedAddresses)
      .values({ userId, stacksAddress: OWNER_A });
    bns.failListings.add(OWNER_A);

    const stats = await runPollCycle(handle.db, bns);
    expect(stats.addressFailures).toBe(1);
    expect(await handle.db.select().from(trackedNames)).toHaveLength(0);
  });
});

describe("expiry alerts ('own' mode)", () => {
  it("enqueues the 30d tier exactly once across repeated cycles", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedNames)
      .values({ userId, fqn: "alpha.btc", mode: "own" });
    bns.states.set(
      "alpha.btc",
      makeState({
        fqn: "alpha.btc",
        renewalHeight: 1_000_000,
        currentBurnBlock: 996_000, // 4000 blocks ≈ 27 days left
      }),
    );

    const first = await runPollCycle(handle.db, bns);
    expect(first.alertsEnqueued).toBe(1);
    const second = await runPollCycle(handle.db, bns);
    expect(second.alertsEnqueued).toBe(0);

    const alerts = await alertsFor(userId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      alertType: "expiry-30d",
      suppressed: false,
      deliveredAt: null,
    });
    expect(alerts[0]!.payload).toMatchObject({ fqn: "alpha.btc" });
  });

  it("delivers only the most urgent tier when a name is tracked late", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedNames)
      .values({ userId, fqn: "alpha.btc", mode: "own" });
    bns.states.set(
      "alpha.btc",
      makeState({
        fqn: "alpha.btc",
        renewalHeight: 1_000_000,
        currentBurnBlock: 999_930, // ~12 hours left — all three tiers matured
      }),
    );

    const stats = await runPollCycle(handle.db, bns);
    expect(stats.alertsEnqueued).toBe(1);
    expect(stats.alertsSuppressed).toBe(2);

    const alerts = await alertsFor(userId);
    const deliverable = alerts.filter((a) => !a.suppressed);
    expect(deliverable).toHaveLength(1);
    expect(deliverable[0]!.alertType).toBe("expiry-1d");
  });

  it("walks the grace tiers as the chain advances", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedNames)
      .values({ userId, fqn: "alpha.btc", mode: "own" });

    const at = (height: number) =>
      bns.states.set(
        "alpha.btc",
        makeState({
          fqn: "alpha.btc",
          renewalHeight: 1_000_000,
          currentBurnBlock: height,
          status: height >= 1_000_000 ? "grace" : "active",
        }),
      );

    at(999_900);
    await runPollCycle(handle.db, bns); // fires expiry-1d
    at(1_000_100);
    await runPollCycle(handle.db, bns); // grace begins
    at(1_002_600);
    await runPollCycle(handle.db, bns); // past half of the 5000-block grace

    const alerts = await alertsFor(userId);
    const fired = alerts.filter((a) => !a.suppressed).map((a) => a.alertType);
    expect(fired).toContain("grace-started");
    expect(fired).toContain("grace-half");
  });
});

describe("ownership changes", () => {
  it("alerts once and deactivates tracking when a name moves away", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedAddresses)
      .values({ userId, stacksAddress: OWNER_A });
    bns.listings.set(OWNER_A, [
      { fqn: "alpha.btc", name: "alpha", namespace: "btc", renewalHeight: 1_000_000 },
    ]);
    bns.states.set("alpha.btc", makeState({ fqn: "alpha.btc" }));
    await runPollCycle(handle.db, bns); // baseline: owned by OWNER_A

    // The name is transferred to a stranger.
    bns.listings.set(OWNER_A, []);
    bns.states.set("alpha.btc", makeState({ fqn: "alpha.btc", owner: OWNER_B }));
    const stats = await runPollCycle(handle.db, bns);
    expect(stats.ownershipChanges).toBe(1);

    const alerts = await alertsFor(userId);
    expect(alerts.map((a) => a.alertType)).toEqual(["owner-changed"]);

    const tracked = await handle.db.select().from(trackedNames);
    expect(tracked[0]!.active).toBe(false);

    // Later cycles: name expires under its new owner — no alerts for us.
    bns.states.set(
      "alpha.btc",
      makeState({
        fqn: "alpha.btc",
        owner: OWNER_B,
        status: "grace",
        currentBurnBlock: 1_000_100,
      }),
    );
    const later = await runPollCycle(handle.db, bns);
    expect(later.alertsEnqueued).toBe(0);
  });

  it("stays quiet when the name moves between the user's own addresses", async () => {
    const userId = await makeUser();
    await handle.db.insert(trackedAddresses).values([
      { userId, stacksAddress: OWNER_A },
      { userId, stacksAddress: OWNER_B },
    ]);
    bns.listings.set(OWNER_A, [
      { fqn: "alpha.btc", name: "alpha", namespace: "btc", renewalHeight: 1_000_000 },
    ]);
    bns.states.set("alpha.btc", makeState({ fqn: "alpha.btc" }));
    await runPollCycle(handle.db, bns);

    bns.listings.set(OWNER_A, []);
    bns.listings.set(OWNER_B, [
      { fqn: "alpha.btc", name: "alpha", namespace: "btc", renewalHeight: 1_000_000 },
    ]);
    bns.states.set("alpha.btc", makeState({ fqn: "alpha.btc", owner: OWNER_B }));
    const stats = await runPollCycle(handle.db, bns);

    expect(stats.ownershipChanges).toBe(0);
    expect(await alertsFor(userId)).toHaveLength(0);
  });
});

describe("availability alerts ('want' mode)", () => {
  it("fires exactly once when the watched name becomes acquirable", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedNames)
      .values({ userId, fqn: "prize.btc", mode: "want" });
    bns.states.set("prize.btc", makeState({ fqn: "prize.btc", status: "grace" }));
    await runPollCycle(handle.db, bns);
    expect(await alertsFor(userId)).toHaveLength(0); // grace ≠ available

    bns.states.set(
      "prize.btc",
      makeState({ fqn: "prize.btc", status: "available" }),
    );
    const stats = await runPollCycle(handle.db, bns);
    expect(stats.alertsEnqueued).toBe(1);
    await runPollCycle(handle.db, bns);

    const alerts = await alertsFor(userId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.alertType).toBe("available");
  });

  it("never alerts from a failed or ambiguous fetch", async () => {
    const userId = await makeUser();
    await handle.db
      .insert(trackedNames)
      .values({ userId, fqn: "prize.btc", mode: "want" });

    // Fetch failure: no state row, no alert.
    bns.failResolves.add("prize.btc");
    const failed = await runPollCycle(handle.db, bns);
    expect(failed.nameFailures).toBe(1);
    expect(await alertsFor(userId)).toHaveLength(0);
    expect(await handle.db.select().from(nameState)).toHaveLength(0);

    // Ambiguous data: status unknown, still no alert.
    bns.failResolves.clear();
    bns.states.set(
      "prize.btc",
      makeState({ fqn: "prize.btc", status: "unknown", renewalHeight: null }),
    );
    await runPollCycle(handle.db, bns);
    expect(await alertsFor(userId)).toHaveLength(0);
  });
});
