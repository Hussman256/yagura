import {
  BURN_BLOCKS_PER_DAY,
  NAME_GRACE_PERIOD_BLOCKS,
  formatApproxBlocks,
  type NameStatus,
} from "@yagura/core";

/**
 * A burning fuse: how close a name is to needing action, rendered as a
 * fill-and-glow bar rather than another number. Only meaningful for
 * `active` (within the 30-day alert window) and `grace` names — anything
 * else (nonexpiring, available, unknown) renders nothing.
 */

const ALERT_WINDOW_BLOCKS = 30 * BURN_BLOCKS_PER_DAY;
const URGENT_WINDOW_BLOCKS = 7 * BURN_BLOCKS_PER_DAY;

type Tone = "calm" | "warn" | "urgent";

// Glow uses the same CSS custom properties as the bar/text (via color-mix),
// so it re-tints correctly when the light/dark theme variables change.
const TONE_STYLES: Record<Tone, { bar: string; glowVar: string; text: string; blur: string }> = {
  calm: { bar: "bg-moss", glowVar: "var(--color-moss)", text: "text-moss", blur: "10px" },
  warn: { bar: "bg-amber", glowVar: "var(--color-amber)", text: "text-amber", blur: "10px" },
  urgent: { bar: "bg-shu", glowVar: "var(--color-shu)", text: "text-shu", blur: "12px" },
};

export function EmberBar({
  renewalHeight,
  currentBurnBlock,
  status,
}: {
  renewalHeight: number | null;
  currentBurnBlock: number;
  status: NameStatus;
}) {
  if (renewalHeight === null || (status !== "active" && status !== "grace")) {
    return null;
  }

  let fraction: number;
  let tone: Tone;
  let label: string;

  if (status === "grace") {
    const elapsed = currentBurnBlock - renewalHeight;
    fraction = Math.min(1, Math.max(0, elapsed / NAME_GRACE_PERIOD_BLOCKS));
    tone = fraction >= 0.5 ? "urgent" : "warn";
    const left = NAME_GRACE_PERIOD_BLOCKS - elapsed;
    label =
      left > 0
        ? `grace ends in ${formatApproxBlocks(left)} — anyone can take it after`
        : "grace window closing";
  } else {
    const remaining = renewalHeight - currentBurnBlock;
    if (remaining > ALERT_WINDOW_BLOCKS) {
      fraction = 0.04;
      tone = "calm";
      label = "quiet — outside the 30-day alert window";
    } else {
      fraction = Math.min(1, Math.max(0, 1 - remaining / ALERT_WINDOW_BLOCKS));
      tone = remaining <= URGENT_WINDOW_BLOCKS ? "urgent" : "warn";
      label = `expires in ${formatApproxBlocks(remaining)}`;
    }
  }

  const style = TONE_STYLES[tone];

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between font-mono text-[11px] tracking-wider text-washi-dim uppercase">
        <span>watch-fire</span>
        <span className={style.text}>{label}</span>
      </div>
      <div className="relative mt-2 h-1.5 w-full bg-ink-line">
        <div
          className={`h-full ${style.bar} transition-[width] duration-700`}
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${style.bar}`}
          style={{
            left: `calc(${fraction * 100}% - 5px)`,
            boxShadow: `0 0 ${style.blur} color-mix(in srgb, ${style.glowVar} 60%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
