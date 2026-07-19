import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { splitFqn, YaguraBnsClient } from "../src/bns-client.js";

/**
 * Client tests run against recorded fixtures of real API responses
 * (captured from api.bnsv2.com on 2026-07-19) served by a fake fetch —
 * no network, fully deterministic.
 */

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, "fixtures", name), "utf-8"),
  );

/** Build a fetch stub that routes URL substrings to fixture bodies. */
function fakeFetch(routes: Record<string, unknown | 404>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    for (const [match, body] of Object.entries(routes)) {
      if (url.includes(match)) {
        if (body === 404) return new Response("not found", { status: 404 });
        return Response.json(body);
      }
    }
    throw new Error(`unstubbed request in test: ${url}`);
  }) as typeof fetch;
}

function makeClient(routes: Record<string, unknown | 404>): YaguraBnsClient {
  const fetchImpl = fakeFetch(routes);
  return new YaguraBnsClient({
    bnsApi: { fetchImpl },
    hiro: { fetchImpl },
  });
}

describe("splitFqn", () => {
  it("splits on the last dot and normalises case", () => {
    expect(splitFqn("Muneeb.BTC")).toEqual({ name: "muneeb", namespace: "btc" });
    expect(splitFqn("a.b.btc")).toEqual({ name: "a.b", namespace: "btc" });
  });

  it("rejects strings that are not fully qualified", () => {
    expect(() => splitFqn("muneeb")).toThrow();
    expect(() => splitFqn(".btc")).toThrow();
    expect(() => splitFqn("muneeb.")).toThrow();
  });
});

describe("YaguraBnsClient.resolveName", () => {
  it("resolves an active .btc name from recorded responses", async () => {
    const client = makeClient({
      "/names/muneeb.btc": fixture("muneeb-btc.json"),
      "/namespaces/btc": fixture("namespace-btc.json"),
    });
    const state = await client.resolveName("muneeb.btc");
    expect(state).toMatchObject({
      fqn: "muneeb.btc",
      owner: "SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF",
      renewalHeight: 1_126_023,
      lifetime: 262_800,
      status: "active",
      isManaged: false,
    });
  });

  it("marks names in lifetime-0 namespaces nonexpiring", async () => {
    const record = structuredClone(
      fixture("muneeb-btc.json"),
    ) as {
      data: { full_name: string; namespace_string: string; renewal_height: string };
    };
    record.data.full_name = "muneeb_dumped_his.stx";
    record.data.namespace_string = "stx";
    record.data.renewal_height = "0";
    const client = makeClient({
      "/names/muneeb_dumped_his.stx": record,
      "/namespaces/stx": fixture("namespace-stx.json"),
    });
    const state = await client.resolveName("muneeb_dumped_his.stx");
    expect(state.status).toBe("nonexpiring");
    expect(state.renewalHeight).toBeNull();
  });

  it("reports unregistered names as registrable only when the namespace exists", async () => {
    const client = makeClient({
      "/names/free-name.btc": 404,
      "/namespaces/btc": fixture("namespace-btc.json"),
      "/v2/info": { burn_block_height: 958_700 },
    });
    const state = await client.resolveName("free-name.btc");
    expect(state.status).toBe("unregistered");
    expect(state.owner).toBeNull();
    expect(state.currentBurnBlock).toBe(958_700);
  });

  it("returns unknown — never available — when the namespace lookup fails", async () => {
    const client = makeClient({
      "/names/some-name.mystery": 404,
      "/namespaces/mystery": 404,
      "/v2/info": { burn_block_height: 958_700 },
    });
    const state = await client.resolveName("some-name.mystery");
    expect(state.status).toBe("unknown");
  });
});

describe("YaguraBnsClient.listNamesOwnedBy", () => {
  it("parses owned names and maps renewal height 0 to null", async () => {
    const client = makeClient({
      "/names/address/SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF/valid": fixture(
        "address-names.json",
      ),
    });
    const owned = await client.listNamesOwnedBy(
      "SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF",
    );
    expect(owned).toEqual([
      {
        fqn: "muneeb.btc",
        name: "muneeb",
        namespace: "btc",
        renewalHeight: 1_126_023,
      },
      {
        fqn: "muneeb_dumped_his.stx",
        name: "muneeb_dumped_his",
        namespace: "stx",
        renewalHeight: null,
      },
    ]);
  });
});
