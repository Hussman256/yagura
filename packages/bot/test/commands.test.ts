import type { BnsReader, NameState, OwnedName } from "@yagura/core";
import {
  createDb,
  pendingTracks,
  trackedAddresses,
  trackedNames,
  users,
  type YaguraDbHandle,
} from "@yagura/core/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cmdAddress,
  cmdEmail,
  cmdTrack,
  cmdUntrack,
  cmdVerify,
  clearExpiredPendingTracks,
  ensureUser,
  parseStartPayload,
  takePendingTrack,
} from "../src/commands.js";
import type { EmailProvider, EmailResult, OutboundEmail } from "../src/email.js";

const OWNER = "SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF";

class FakeBns implements BnsReader {
  states = new Map<string, NameState>();
  async resolveName(fqn: string): Promise<NameState> {
    const state = this.states.get(fqn);
    if (!state) throw new Error(`no scripted state for ${fqn}`);
    return state;
  }
  async listNamesOwnedBy(): Promise<OwnedName[]> {
    return [];
  }
}

class FakeEmail implements EmailProvider {
  sent: OutboundEmail[] = [];
  async send(email: OutboundEmail): Promise<EmailResult> {
    this.sent.push(email);
    return "sent";
  }
}

function activeState(fqn: string, owner: string | null): NameState {
  const [name = "", namespace = ""] = fqn.split(".");
  return {
    fqn,
    name,
    namespace,
    owner,
    renewalHeight: 1_126_023,
    lifetime: 262_800,
    status: owner ? "active" : "unregistered",
    currentBurnBlock: 958_000,
    isManaged: false,
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

describe("parseStartPayload", () => {
  it("decodes the web app's deep-link payloads", () => {
    expect(parseStartPayload(`address-${OWNER}`)).toEqual({
      kind: "address",
      address: OWNER,
    });
    const encoded = `w_${Buffer.from("muneeb.btc").toString("base64url")}`;
    expect(parseStartPayload(encoded)).toEqual({ kind: "watch", fqn: "muneeb.btc" });
  });

  it("ignores empty, unknown, and malformed payloads", () => {
    expect(parseStartPayload("")).toEqual({ kind: "none" });
    expect(parseStartPayload("hello")).toEqual({ kind: "none" });
    expect(parseStartPayload("w_%%%")).toEqual({ kind: "none" });
    // Decodes but isn't a name.namespace — refused.
    expect(parseStartPayload(`w_${Buffer.from("rm -rf /").toString("base64url")}`)).toEqual(
      { kind: "none" },
    );
  });
});

describe("ensureUser", () => {
  it("creates once per chat and revives a dead telegram channel", async () => {
    const first = await ensureUser(handle.db, "42");
    const second = await ensureUser(handle.db, "42");
    expect(second.id).toBe(first.id);

    await handle.db
      .update(users)
      .set({ telegramActive: false })
      .where(eq(users.id, first.id));
    const revived = await ensureUser(handle.db, "42");
    expect(revived.telegramActive).toBe(true);
  });
});

describe("cmdAddress", () => {
  it("accepts a mainnet address and rejects garbage", async () => {
    const user = await ensureUser(handle.db, "42");
    expect(await cmdAddress(handle.db, user, OWNER)).toContain(OWNER);
    expect(await cmdAddress(handle.db, user, "not-an-address")).toContain(
      "doesn't look like",
    );
    const rows = await handle.db.select().from(trackedAddresses);
    expect(rows).toHaveLength(1);
  });
});

describe("cmdTrack", () => {
  it("auto-tracks as 'own' when a tracked address owns the name", async () => {
    const user = await ensureUser(handle.db, "42");
    await cmdAddress(handle.db, user, OWNER);
    bns.states.set("muneeb.btc", activeState("muneeb.btc", OWNER));

    const outcome = await cmdTrack(handle.db, bns, user, "muneeb.btc");
    expect(outcome.kind).toBe("done");
    const rows = await handle.db.select().from(trackedNames);
    expect(rows[0]).toMatchObject({ fqn: "muneeb.btc", mode: "own" });
  });

  it("asks own-vs-want when the owner is unknown to us, persisting the question to the DB", async () => {
    const user = await ensureUser(handle.db, "42");
    bns.states.set("stranger.btc", activeState("stranger.btc", "SP2SOMEONEELSE"));

    const outcome = await cmdTrack(handle.db, bns, user, "stranger.btc");
    expect(outcome.kind).toBe("ask");
    expect(await handle.db.select().from(trackedNames)).toHaveLength(0);

    // The question survives as a row — simulating the webhook's next,
    // stateless invocation when the inline button is tapped.
    const pending = await handle.db.select().from(pendingTracks);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ userId: user.id, fqn: "stranger.btc" });
  });

  it("watches unregistered names directly", async () => {
    const user = await ensureUser(handle.db, "42");
    bns.states.set("free.btc", activeState("free.btc", null));

    const outcome = await cmdTrack(handle.db, bns, user, "free.btc");
    expect(outcome.kind).toBe("done");
    const rows = await handle.db.select().from(trackedNames);
    expect(rows[0]).toMatchObject({ fqn: "free.btc", mode: "want" });
  });
});

describe("takePendingTrack / clearExpiredPendingTracks", () => {
  it("resolves and clears the pending question exactly once", async () => {
    const user = await ensureUser(handle.db, "42");
    bns.states.set("stranger.btc", activeState("stranger.btc", "SP2SOMEONEELSE"));
    await cmdTrack(handle.db, bns, user, "stranger.btc");

    expect(await takePendingTrack(handle.db, user.id)).toBe("stranger.btc");
    // Second call — nothing left to take (the row is deleted, not just read).
    expect(await takePendingTrack(handle.db, user.id)).toBeNull();
  });

  it("refuses an expired question even if the row hasn't been swept yet", async () => {
    const user = await ensureUser(handle.db, "42");
    await handle.db.insert(pendingTracks).values({
      userId: user.id,
      fqn: "stale.btc",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await takePendingTrack(handle.db, user.id)).toBeNull();
  });

  it("sweeps expired rows", async () => {
    const user = await ensureUser(handle.db, "42");
    await handle.db.insert(pendingTracks).values({
      userId: user.id,
      fqn: "stale.btc",
      expiresAt: new Date(Date.now() - 1000),
    });
    await clearExpiredPendingTracks(handle.db);
    expect(await handle.db.select().from(pendingTracks)).toHaveLength(0);
  });

  it("a fresh /track replaces rather than duplicates a still-open question", async () => {
    const user = await ensureUser(handle.db, "42");
    bns.states.set("first.btc", activeState("first.btc", "SP2SOMEONEELSE"));
    bns.states.set("second.btc", activeState("second.btc", "SP2SOMEONEELSE"));
    await cmdTrack(handle.db, bns, user, "first.btc");
    await cmdTrack(handle.db, bns, user, "second.btc");

    expect(await handle.db.select().from(pendingTracks)).toHaveLength(1);
    expect(await takePendingTrack(handle.db, user.id)).toBe("second.btc");
  });
});

describe("cmdUntrack", () => {
  it("removes manual tracks and warns about discovered ones", async () => {
    const user = await ensureUser(handle.db, "42");
    await handle.db.insert(trackedNames).values([
      { userId: user.id, fqn: "manual.btc", mode: "own", source: "manual" },
      { userId: user.id, fqn: "auto.btc", mode: "own", source: "discovered" },
    ]);

    expect(await cmdUntrack(handle.db, user, "manual.btc")).toBe(
      "Stopped tracking manual.btc.",
    );
    expect(await cmdUntrack(handle.db, user, "auto.btc")).toContain(
      "auto-discovered",
    );
    expect(await cmdUntrack(handle.db, user, "ghost.btc")).toContain(
      "aren't tracking",
    );
    expect(await handle.db.select().from(trackedNames)).toHaveLength(0);
  });
});

describe("email verification flow", () => {
  it("stores the address unverified, then verifies with the mailed code", async () => {
    const email = new FakeEmail();
    let user = await ensureUser(handle.db, "42");

    const reply = await cmdEmail(handle.db, email, user, "Watch@Example.com");
    expect(reply).toContain("watch@example.com");
    expect(email.sent).toHaveLength(1);
    const code = /code is: (\d{6})/.exec(email.sent[0]!.text)?.[1];
    expect(code).toBeDefined();

    // Wrong code first, then the right one.
    user = (await handle.db.select().from(users).where(eq(users.id, user.id)))[0]!;
    expect(user.emailVerified).toBe(false);
    expect(await cmdVerify(handle.db, user, "000000")).toBe("Wrong code.");
    expect(await cmdVerify(handle.db, user, code!)).toContain("verified");

    user = (await handle.db.select().from(users).where(eq(users.id, user.id)))[0]!;
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifyCode).toBeNull();
  });

  it("rejects expired codes", async () => {
    const email = new FakeEmail();
    let user = await ensureUser(handle.db, "42");
    await cmdEmail(handle.db, email, user, "watch@example.com");
    await handle.db
      .update(users)
      .set({ emailVerifyExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(users.id, user.id));
    user = (await handle.db.select().from(users).where(eq(users.id, user.id)))[0]!;
    const code = /code is: (\d{6})/.exec(email.sent[0]!.text)![1]!;
    expect(await cmdVerify(handle.db, user, code)).toContain("expired");
  });
});
