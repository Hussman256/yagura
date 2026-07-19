import { BURN_BLOCK_SECONDS, BURN_BLOCKS_PER_DAY } from "./constants.js";

/**
 * Block-height → wall-clock estimation.
 *
 * BNS expiry is measured in Bitcoin burn block heights, not dates. We convert
 * for display using a flat ~10 min/block assumption (see BURN_BLOCK_SECONDS).
 * Real block intervals wander, so estimates drift — which is why callers must
 * recompute from the live burn height on every poll instead of storing dates.
 */

/** Milliseconds a span of burn blocks approximately covers. */
export function burnBlocksToMs(blocks: number): number {
  return blocks * BURN_BLOCK_SECONDS * 1000;
}

/**
 * Estimate the wall-clock date a burn height will be reached (or was reached,
 * if it is in the past relative to `currentBurnBlock`).
 */
export function estimateBurnBlockDate(
  targetBurnBlock: number,
  currentBurnBlock: number,
  now: Date = new Date(),
): Date {
  return new Date(
    now.getTime() + burnBlocksToMs(targetBurnBlock - currentBurnBlock),
  );
}

/** Whole days a span of burn blocks approximately covers (rounded down). */
export function burnBlocksToDays(blocks: number): number {
  return Math.floor(blocks / BURN_BLOCKS_PER_DAY);
}

/**
 * Human-friendly approximate duration for alert copy, e.g. "~29 days",
 * "~5 hours", "~30 minutes". Always prefixed with "~" because it IS
 * approximate.
 */
export function formatApproxBlocks(blocks: number): string {
  const abs = Math.abs(blocks);
  if (abs >= BURN_BLOCKS_PER_DAY) {
    const days = Math.round(abs / BURN_BLOCKS_PER_DAY);
    return `~${days} day${days === 1 ? "" : "s"}`;
  }
  if (abs >= 6) {
    const hours = Math.round(abs / 6);
    return `~${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const minutes = Math.max(10, abs * 10);
  return `~${minutes} minutes`;
}
