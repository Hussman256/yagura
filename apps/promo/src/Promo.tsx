import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { Background } from "./components/Background";
import { ColdOpen } from "./scenes/ColdOpen";
import { Tagline } from "./scenes/Tagline";
import { Problem } from "./scenes/Problem";
import { Alert } from "./scenes/Alert";
import { Renew } from "./scenes/Renew";
import { Availability } from "./scenes/Availability";
import { Outro } from "./scenes/Outro";

const FADE = 12;

/** Wraps a scene with a fade-in/fade-out so cuts between Sequences don't hard-jump. */
function Fade({ duration, children }: { duration: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, FADE, duration - FADE, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

// Scene timeline, 30fps.
const SCENES: { from: number; duration: number; node: React.ReactNode }[] = [
  { from: 0, duration: 90, node: <ColdOpen /> },
  { from: 90, duration: 105, node: <Tagline /> },
  { from: 195, duration: 105, node: <Problem /> },
  { from: 300, duration: 120, node: <Alert /> },
  { from: 420, duration: 105, node: <Renew /> },
  { from: 525, duration: 90, node: <Availability /> },
  { from: 615, duration: 105, node: <Outro /> },
];

export const TOTAL_DURATION = 720; // 24s at 30fps

export function Promo() {
  return (
    <AbsoluteFill>
      <Background />
      {SCENES.map((scene, i) => (
        <Sequence key={i} from={scene.from} durationInFrames={scene.duration}>
          <Fade duration={scene.duration}>{scene.node}</Fade>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
