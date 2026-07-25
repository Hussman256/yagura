import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { LiveTower } from "../components/Tower";
import { BeaconGlow } from "../components/Background";
import { Watermark } from "../components/Watermark";
import { color, font } from "../theme";

/** 615-720 (3.5s): the sign-off — mark, tagline, and where to find it. */
export function Outro() {
  const frame = useCurrentFrame();

  const towerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [24, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const linksOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BeaconGlow opacity={0.8} />
      <Watermark opacity={0.045} style={{ bottom: "6%", left: "6%" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{ opacity: towerOpacity }}>
          <LiveTower height={200} />
        </div>
        <div style={{ opacity: towerOpacity, fontFamily: font.display, fontSize: 56, color: color.washi }}>
          Yagura <span style={{ color: color.washiDim }}>櫓</span>
        </div>
        <div
          style={{
            opacity: taglineOpacity,
            fontFamily: font.sans,
            fontSize: 26,
            color: color.washiDim,
          }}
        >
          The watchtower for your BNS names.
        </div>
        <div
          style={{
            opacity: linksOpacity,
            marginTop: 14,
            display: "flex",
            gap: 34,
            fontFamily: font.mono,
            fontSize: 18,
            letterSpacing: 1,
            color: color.shu,
          }}
        >
          <span>yagura-two.vercel.app</span>
          <span style={{ color: color.washiDim }}>·</span>
          <span>@yagurabot</span>
          <span style={{ color: color.washiDim }}>·</span>
          <span>x.com/Yagura_btc</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
