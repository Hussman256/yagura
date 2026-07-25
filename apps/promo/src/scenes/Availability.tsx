import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { NameCard } from "../components/Mocks";
import { color, font } from "../theme";

/** 525-615 (3s): the offensive side — a watched name flips to claimable. */
export function Availability() {
  const frame = useCurrentFrame();

  const captionOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const flipped = frame >= 42;
  const flipT = interpolate(frame, [38, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // abs() matters here: a bare cos() goes negative past the midpoint, which
  // mirrors the card's content instead of completing the flip.
  const scaleX = Math.abs(Math.cos(flipT * Math.PI));

  const ringT = interpolate(frame, [46, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringScale = interpolate(ringT, [0, 1], [1, 2.4]);
  const ringOpacity = interpolate(ringT, [0, 1], [0.55, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <div
          style={{
            opacity: captionOpacity,
            fontFamily: font.sans,
            fontSize: 30,
            color: color.washi,
            textAlign: "center",
            maxWidth: 760,
          }}
        >
          Watching a name someone else holds?
        </div>
        <div style={{ opacity: cardOpacity, position: "relative", transform: `scaleX(${scaleX})` }}>
          {flipped && (
            <div
              style={{
                position: "absolute",
                inset: -40,
                border: `2px solid ${color.shu}`,
                borderRadius: "50%",
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
                pointerEvents: "none",
              }}
            />
          )}
          <NameCard fqn="yagura.btc" status={flipped ? "available" : "unregistered"} />
        </div>
        {flipped && (
          <div
            style={{
              opacity: interpolate(frame, [50, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              fontFamily: font.sans,
              fontSize: 30,
              color: color.washi,
              textAlign: "center",
            }}
          >
            You&apos;ll hear the moment it&apos;s <span style={{ color: color.shu }}>claimable.</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
