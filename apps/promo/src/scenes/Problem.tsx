import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { NameCard } from "../components/Mocks";
import { EmberBar } from "../components/EmberBar";
import { color, font } from "../theme";

/** 195-300 (3.5s): a name's countdown fast-forwards to urgent — the problem, stated visually. */
export function Problem() {
  const frame = useCurrentFrame();

  const cardOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(frame, [0, 18], [14, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const fraction = interpolate(frame, [24, 95], [0.06, 0.98], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const tone = fraction < 0.55 ? "calm" : fraction < 0.85 ? "warn" : "urgent";
  const label =
    frame < 45 ? "expires in ~46 days" : frame < 75 ? "expires in ~12 days" : "expires in ~2 days";

  const captionOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pulse = tone === "urgent" ? interpolate(frame % 12, [0, 6, 12], [1, 1.015, 1]) : 1;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardY}px) scale(${pulse})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        <NameCard fqn="rareword.btc" status="active">
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 13,
                letterSpacing: 2,
                color: color.washiDim,
                textTransform: "uppercase",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>watch-fire</span>
              <span style={{ color: tone === "urgent" ? color.shu : tone === "warn" ? color.amber : color.moss }}>
                {label}
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <EmberBar fraction={fraction} tone={tone} width={412} />
            </div>
          </div>
        </NameCard>
        <div
          style={{
            opacity: captionOpacity,
            fontFamily: font.sans,
            fontSize: 30,
            color: color.washi,
            textAlign: "center",
            maxWidth: 720,
          }}
        >
          BNS names expire by Bitcoin block height —{" "}
          <span style={{ color: color.shu }}>silently.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
