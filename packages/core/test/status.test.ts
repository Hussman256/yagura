import { describe, expect, it } from "vitest";

import { NAME_GRACE_PERIOD_BLOCKS } from "../src/constants.js";
import { deriveNameStatus, effectiveRenewalHeight } from "../src/status.js";

const base = {
  renewalHeight: 1_000_000,
  lifetime: 262_800, // .btc lifetime as verified on-chain
  launchedAt: 0,
  imported: false,
};

describe("deriveNameStatus", () => {
  it("is active before the renewal height", () => {
    expect(
      deriveNameStatus({ ...base, currentBurnBlock: 999_999 }),
    ).toBe("active");
  });

  it("enters grace exactly at the renewal height", () => {
    expect(
      deriveNameStatus({ ...base, currentBurnBlock: 1_000_000 }),
    ).toBe("grace");
  });

  it("stays in grace until the last grace block", () => {
    expect(
      deriveNameStatus({
        ...base,
        currentBurnBlock: 1_000_000 + NAME_GRACE_PERIOD_BLOCKS - 1,
      }),
    ).toBe("grace");
  });

  it("becomes available the block grace ends", () => {
    expect(
      deriveNameStatus({
        ...base,
        currentBurnBlock: 1_000_000 + NAME_GRACE_PERIOD_BLOCKS,
      }),
    ).toBe("available");
  });

  it("treats lifetime 0 as nonexpiring regardless of heights", () => {
    expect(
      deriveNameStatus({
        ...base,
        lifetime: 0,
        renewalHeight: 0,
        currentBurnBlock: 5_000_000,
      }),
    ).toBe("nonexpiring");
  });

  it("resolves imported names (renewal height 0) via launched-at + lifetime", () => {
    // Contract rule from get-renewal-height: imported ⇒ launched-at + lifetime.
    expect(
      deriveNameStatus({
        renewalHeight: 0,
        lifetime: 52_595,
        launchedAt: 900_000,
        imported: true,
        currentBurnBlock: 910_000,
      }),
    ).toBe("active");
  });

  it("refuses to classify renewal height 0 without a proven import", () => {
    // Precision rule: never derive "available" from ambiguous data.
    expect(
      deriveNameStatus({
        renewalHeight: 0,
        lifetime: 52_595,
        launchedAt: 900_000,
        imported: false,
        currentBurnBlock: 5_000_000,
      }),
    ).toBe("unknown");
  });
});

describe("effectiveRenewalHeight", () => {
  it("passes through a real renewal height", () => {
    expect(effectiveRenewalHeight(base)).toBe(1_000_000);
  });

  it("is null for nonexpiring namespaces", () => {
    expect(effectiveRenewalHeight({ ...base, lifetime: 0 })).toBeNull();
  });

  it("computes launched-at + lifetime for imported names", () => {
    expect(
      effectiveRenewalHeight({
        renewalHeight: 0,
        lifetime: 52_595,
        launchedAt: 900_000,
        imported: true,
      }),
    ).toBe(952_595);
  });

  it("is null when the height cannot be proven", () => {
    expect(
      effectiveRenewalHeight({
        renewalHeight: 0,
        lifetime: 52_595,
        launchedAt: null,
        imported: true,
      }),
    ).toBeNull();
  });
});
