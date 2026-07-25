import { font, color } from "../theme";

/** The giant background kanji, felt as texture rather than read as text. */
export function Watermark({
  opacity = 0.045,
  size = 62,
  style,
}: {
  opacity?: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: font.display,
        fontSize: size + "vw",
        color: color.washi,
        opacity,
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
    >
      櫓
    </div>
  );
}
