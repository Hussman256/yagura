import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { Watermark } from "../components/Watermark";
import { BeaconGlow } from "../components/Background";
import { color, font } from "../theme";

function Rise({
  children,
  delay,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [delay, delay + 18], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>{children}</div>
  );
}

/** 90-195 (3.5s): the hero line from the site, staggered in the same rhythm as the web hero. */
export function Tagline() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BeaconGlow opacity={0.6} />
      <Watermark opacity={0.04} style={{ right: "4%", top: "10%" }} />
      <div style={{ maxWidth: 1300, padding: "0 60px" }}>
        <Rise delay={0}>
          <div
            style={{
              fontFamily: font.mono,
              fontSize: 22,
              letterSpacing: 6,
              color: color.shu,
              textTransform: "uppercase",
            }}
          >
            watchtower · bitcoin name system · stacks
          </div>
        </Rise>
        <Rise delay={10} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: font.display, fontSize: 82, lineHeight: 1.1, color: color.washi }}>
            Never lose the name you own.
          </div>
        </Rise>
        <Rise delay={20} style={{ marginTop: 4 }}>
          <div style={{ fontFamily: font.display, fontSize: 82, lineHeight: 1.1, color: color.washiDim }}>
            Never miss the one you want.
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
}
