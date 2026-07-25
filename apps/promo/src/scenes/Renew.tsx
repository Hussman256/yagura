import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { NameCard, CtaButton } from "../components/Mocks";
import { EmberBar } from "../components/EmberBar";
import { color, font } from "../theme";

/** 420-525 (3.5s): one tap, done. The button press is the whole pitch. */
export function Renew() {
  const frame = useCurrentFrame();

  const cardOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  const cursorProgress = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cursorX = interpolate(cursorProgress, [0, 1], [220, 0]);
  const cursorY = interpolate(cursorProgress, [0, 1], [-140, 0]);
  const cursorOpacity = interpolate(frame, [8, 16, 44, 50], [0, 1, 1, 0]);

  const pressed = frame >= 34 && frame < 44;
  const submitted = frame >= 44;

  const barFraction = submitted
    ? interpolate(frame, [44, 80], [0.98, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0.98;
  const barTone = submitted ? "calm" : "urgent";

  const submittedOpacity = interpolate(frame, [46, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: cardOpacity, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <NameCard fqn="rareword.btc" status={submitted ? "active" : "grace"}>
          <div style={{ marginTop: 18 }}>
            <EmberBar fraction={barFraction} tone={barTone as "calm" | "urgent"} width={412} />
          </div>
          <div style={{ marginTop: 26, position: "relative", display: "inline-block" }}>
            <CtaButton pressed={pressed}>→ renew rareword.btc</CtaButton>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${color.washi}`,
                opacity: cursorOpacity,
                transform: `translate(calc(-50% + ${cursorX}px), calc(-50% + ${cursorY}px))`,
              }}
            />
            {submitted && (
              <div
                style={{
                  marginTop: 18,
                  opacity: submittedOpacity,
                  fontFamily: font.mono,
                  fontSize: 16,
                  color: color.moss,
                }}
              >
                ✓ renewal submitted
              </div>
            )}
          </div>
        </NameCard>
        <div style={{ fontFamily: font.sans, fontSize: 30, color: color.washi, textAlign: "center", maxWidth: 700 }}>
          Every alert links straight to <span style={{ color: color.shu }}>one-tap renewal.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
