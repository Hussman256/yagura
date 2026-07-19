import {
  burnBlocksToDays,
  estimateBurnBlockDate,
  formatApproxBlocks,
  type NameStatus,
} from "@yagura/core";

/** Copy + color for each lifecycle status, shared by badges everywhere. */
export const STATUS_META: Record<
  NameStatus,
  { label: string; className: string }
> = {
  active: { label: "active", className: "text-moss border-moss/40" },
  grace: { label: "grace period", className: "text-amber border-amber/40" },
  available: { label: "available", className: "text-shu border-shu/40" },
  nonexpiring: { label: "never expires", className: "text-washi-dim border-ink-line" },
  unregistered: { label: "unregistered", className: "text-shu border-shu/40" },
  unknown: { label: "unknown", className: "text-washi-dim border-ink-line" },
};

/** "in ~412 days (est. 2027-09-04)" / "~3 days ago" — always marked approximate. */
export function describeExpiry(
  renewalHeight: number | null,
  currentBurnBlock: number,
): string | null {
  if (renewalHeight === null) return null;
  const delta = renewalHeight - currentBurnBlock;
  const estimate = estimateBurnBlockDate(renewalHeight, currentBurnBlock)
    .toISOString()
    .slice(0, 10);
  return delta >= 0
    ? `in ${formatApproxBlocks(delta)} (est. ${estimate})`
    : `${formatApproxBlocks(delta)} ago (est. ${estimate})`;
}

/** Urgency bucket for countdown coloring in lists. */
export function expiryTone(
  renewalHeight: number | null,
  currentBurnBlock: number,
): "calm" | "warn" | "urgent" {
  if (renewalHeight === null) return "calm";
  const days = burnBlocksToDays(renewalHeight - currentBurnBlock);
  if (days <= 7) return "urgent";
  if (days <= 30) return "warn";
  return "calm";
}

export function truncateAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}
