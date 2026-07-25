import { useCurrentFrame, interpolate, Easing } from "remotion";
import { color } from "../theme";

const TOWER_PATH =
  "M20 236h80M32 236V140h56v96M28 140 16 116h88l-12 24M40 116V64L60 52l20 12v52M60 236v-40M48 92h24M60 52V28";
// Total approximate path length, hand-measured generously for a full draw-on.
const PATH_LENGTH = 620;

/**
 * The watchtower mark, animated: the line work draws itself on (stroke
 * dash reveal), then the beacon lights and starts sweeping. Same silhouette
 * as the web app's hero art (apps/web/app/page.tsx) and header mark.
 */
export function Tower({
  height = 420,
  drawProgress = 1,
  beaconOpacity = 1,
  sweepAngle = 0,
  lineColor = color.inkLine,
}: {
  height?: number;
  /** 0 = undrawn, 1 = fully drawn. */
  drawProgress?: number;
  beaconOpacity?: number;
  /** Degrees, for the sweeping beam. */
  sweepAngle?: number;
  lineColor?: string;
}) {
  const dashOffset = interpolate(drawProgress, [0, 1], [PATH_LENGTH, 0], {
    easing: Easing.out(Easing.cubic),
  });

  return (
    <svg viewBox="0 0 120 240" width={(height * 120) / 240} height={height} fill="none">
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={color.shu} stopOpacity="0" />
          <stop offset="100%" stopColor={color.shu} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g style={{ transform: `rotate(${sweepAngle}deg)`, transformOrigin: "60px 22px" }}>
        <line x1="60" y1="22" x2="60" y2="-56" stroke="url(#beam)" strokeWidth="4" />
      </g>
      <path
        d={TOWER_PATH}
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="square"
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={dashOffset}
      />
      <circle
        cx="60"
        cy="22"
        r="3.5"
        fill={color.shu}
        opacity={beaconOpacity}
        style={{ filter: `drop-shadow(0 0 ${6 * beaconOpacity}px ${color.shu})` }}
      />
    </svg>
  );
}

/** Convenience: a Tower whose beacon breathes and sweeps continuously. */
export function LiveTower(props: { height?: number; drawProgress?: number }) {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame % 96, [0, 48, 96], [0.65, 1, 0.65]);
  const sweep = (frame / 96) * 360;
  return <Tower {...props} beaconOpacity={pulse} sweepAngle={sweep} />;
}
