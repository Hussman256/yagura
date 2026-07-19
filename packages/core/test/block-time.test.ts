import { describe, expect, it } from "vitest";

import {
  burnBlocksToDays,
  burnBlocksToMs,
  estimateBurnBlockDate,
  formatApproxBlocks,
} from "../src/block-time.js";

describe("burnBlocksToMs", () => {
  it("assumes 10 minutes per burn block", () => {
    expect(burnBlocksToMs(1)).toBe(600_000);
    expect(burnBlocksToMs(144)).toBe(24 * 60 * 60 * 1000);
  });
});

describe("estimateBurnBlockDate", () => {
  const now = new Date("2026-07-19T00:00:00Z");

  it("projects future heights forward", () => {
    const estimate = estimateBurnBlockDate(1_000_144, 1_000_000, now);
    expect(estimate.toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("projects past heights backward", () => {
    const estimate = estimateBurnBlockDate(999_856, 1_000_000, now);
    expect(estimate.toISOString()).toBe("2026-07-18T00:00:00.000Z");
  });
});

describe("burnBlocksToDays", () => {
  it("floors partial days", () => {
    expect(burnBlocksToDays(287)).toBe(1);
    expect(burnBlocksToDays(288)).toBe(2);
  });
});

describe("formatApproxBlocks", () => {
  it("formats days, hours, and minutes", () => {
    expect(formatApproxBlocks(4320)).toBe("~30 days");
    expect(formatApproxBlocks(144)).toBe("~1 day");
    expect(formatApproxBlocks(12)).toBe("~2 hours");
    expect(formatApproxBlocks(1)).toBe("~10 minutes");
  });
});
