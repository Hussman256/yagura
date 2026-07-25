import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { AlertBubble } from "../components/Mocks";
import { color, font } from "../theme";

/** 300-420 (4s): the alert arrives. This is the product, in one image. */
export function Alert() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  const slideIn = spring({ frame: frame - 14, fps, config: { damping: 16, mass: 0.7 } });
  const bubbleX = interpolate(slideIn, [0, 1], [80, 0]);
  const bubbleOpacity = interpolate(frame, [14, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const tagOpacity = interpolate(frame, [48, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <div
          style={{
            opacity: captionOpacity,
            fontFamily: font.sans,
            fontSize: 32,
            color: color.washi,
            textAlign: "center",
          }}
        >
          Yagura watches the chain — you get the signal in time.
        </div>
        <div style={{ transform: `translateX(${bubbleX}px)`, opacity: bubbleOpacity }}>
          <AlertBubble text="rareword.btc expires in ~2 days. Renew now → yagura.app/renew" />
        </div>
        <div
          style={{
            opacity: tagOpacity,
            fontFamily: font.mono,
            fontSize: 15,
            letterSpacing: 3,
            color: color.washiDim,
            textTransform: "uppercase",
          }}
        >
          delivered via telegram · email
        </div>
      </div>
    </AbsoluteFill>
  );
}
