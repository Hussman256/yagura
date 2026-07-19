import { describe, expect, it } from "vitest";

import {
  computeDueOwnAlerts,
  computeDueWantAlerts,
  mostUrgent,
  type AlertTier,
} from "../src/alerts.js";

const none = new Set<AlertTier>();
const RENEWAL = 1_000_000;

describe("computeDueOwnAlerts", () => {
  it("fires nothing while expiry is far away", () => {
    expect(
      computeDueOwnAlerts(
        { status: "active", renewalHeight: RENEWAL, currentBurnBlock: RENEWAL - 10_000 },
        none,
      ),
    ).toEqual([]);
  });

  it("fires the 30-day tier once inside the window", () => {
    const inputs = {
      status: "active" as const,
      renewalHeight: RENEWAL,
      currentBurnBlock: RENEWAL - 4000, // < 4320 blocks = inside 30d window
    };
    expect(computeDueOwnAlerts(inputs, none)).toEqual(["expiry-30d"]);
    // Idempotency: once recorded as sent, it never fires again.
    expect(
      computeDueOwnAlerts(inputs, new Set<AlertTier>(["expiry-30d"])),
    ).toEqual([]);
  });

  it("matures every applicable tier when a name is tracked late", () => {
    // Tracked with only ~12 hours left: all three countdown tiers mature at
    // once; the worker delivers only the most urgent and records the rest.
    const due = computeDueOwnAlerts(
      { status: "active", renewalHeight: RENEWAL, currentBurnBlock: RENEWAL - 72 },
      none,
    );
    expect(due).toEqual(["expiry-30d", "expiry-7d", "expiry-1d"]);
    expect(mostUrgent(due)).toBe("expiry-1d");
  });

  it("fires grace-started when the renewal height passes", () => {
    const due = computeDueOwnAlerts(
      { status: "grace", renewalHeight: RENEWAL, currentBurnBlock: RENEWAL + 1 },
      new Set<AlertTier>(["expiry-30d", "expiry-7d", "expiry-1d"]),
    );
    expect(due).toEqual(["grace-started"]);
  });

  it("fires grace-half midway through the grace period", () => {
    const due = computeDueOwnAlerts(
      { status: "grace", renewalHeight: RENEWAL, currentBurnBlock: RENEWAL + 2500 },
      new Set<AlertTier>(["expiry-30d", "expiry-7d", "expiry-1d", "grace-started"]),
    );
    expect(due).toEqual(["grace-half"]);
  });

  it("never alerts on nonexpiring or unknown states", () => {
    for (const status of ["nonexpiring", "unknown", "unregistered"] as const) {
      expect(
        computeDueOwnAlerts(
          { status, renewalHeight: null, currentBurnBlock: 5_000_000 },
          none,
        ),
      ).toEqual([]);
    }
  });
});

describe("computeDueWantAlerts", () => {
  it("fires exactly once when a name becomes acquirable", () => {
    expect(computeDueWantAlerts({ status: "available" }, none)).toEqual([
      "available",
    ]);
    expect(
      computeDueWantAlerts(
        { status: "available" },
        new Set<AlertTier>(["available"]),
      ),
    ).toEqual([]);
  });

  it("treats never-registered names as acquirable", () => {
    expect(computeDueWantAlerts({ status: "unregistered" }, none)).toEqual([
      "available",
    ]);
  });

  it("never fires on ambiguous or safe states", () => {
    for (const status of ["active", "grace", "nonexpiring", "unknown"] as const) {
      expect(computeDueWantAlerts({ status }, none)).toEqual([]);
    }
  });
});
