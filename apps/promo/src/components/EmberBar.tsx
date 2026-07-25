import { color } from "../theme";

type Tone = "calm" | "warn" | "urgent";

const TONE_COLOR: Record<Tone, string> = {
  calm: color.moss,
  warn: color.amber,
  urgent: color.shu,
};

/** The web app's watch-fire progress meter, re-created for video — a fill fraction driven by the caller per-frame. */
export function EmberBar({
  fraction,
  tone,
  width = 420,
}: {
  fraction: number;
  tone: Tone;
  width?: number;
}) {
  const c = TONE_COLOR[tone];
  return (
    <div style={{ width, height: 6, background: color.inkLine, position: "relative" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
          background: c,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `calc(${Math.max(0, Math.min(1, fraction)) * 100}% - 7px)`,
          transform: "translateY(-50%)",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: c,
          boxShadow: `0 0 16px 4px ${c}`,
        }}
      />
    </div>
  );
}
