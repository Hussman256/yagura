import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { color } from "../theme";

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'%3E%3C/feTurbulence%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'%3E%3C/rect%3E%3C/svg%3E";

/**
 * The ink ground every scene sits on: sumi-ink base, faint vertical
 * sightlines (mirrors globals.css's body background), and a flickering
 * grain field. A deterministic per-frame flicker stands in for the web
 * app's CSS steps() animation, which has no frame-accurate equivalent here.
 */
export function Background() {
  const frame = useCurrentFrame();
  const grainOpacity = interpolate(frame % 6, [0, 3, 6], [0.03, 0.045, 0.03]);

  return (
    <AbsoluteFill style={{ backgroundColor: color.ink }}>
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent 149px, rgb(233 228 214 / 0.025) 149px, rgb(233 228 214 / 0.025) 150px)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url("${GRAIN_SVG}")`,
          opacity: grainOpacity,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
}

/** Radial vermillion glow, used behind hero-weight scenes for atmosphere. */
export function BeaconGlow({ opacity = 1 }: { opacity?: number }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 60% 50% at 50% 20%, rgb(229 72 77 / ${0.16 * opacity}), transparent 65%)`,
      }}
    />
  );
}
