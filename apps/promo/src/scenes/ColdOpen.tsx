import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { Watermark } from "../components/Watermark";
import { Tower } from "../components/Tower";
import { color, font } from "../theme";

/** 0-90 (3s): the tower draws itself on, the beacon lights, the wordmark settles. */
export function ColdOpen() {
  const frame = useCurrentFrame();

  const watermarkOpacity = interpolate(frame, [0, 40], [0, 0.05], { extrapolateRight: "clamp" });
  const drawProgress = interpolate(frame, [10, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const beaconOpacity = interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wordmarkOpacity = interpolate(frame, [55, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wordmarkY = interpolate(frame, [55, 78], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Watermark opacity={watermarkOpacity} style={{ top: "18%" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <Tower height={220} drawProgress={drawProgress} beaconOpacity={beaconOpacity} />
        <div
          style={{
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px)`,
            fontFamily: font.display,
            fontSize: 64,
            color: color.washi,
            letterSpacing: 2,
          }}
        >
          Yagura <span style={{ color: color.washiDim }}>櫓</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
