import { color, font } from "../theme";
import { Tower } from "./Tower";

const STATUS_STYLE: Record<string, { label: string; c: string }> = {
  active: { label: "active", c: color.moss },
  grace: { label: "grace period", c: color.amber },
  available: { label: "available", c: color.shu },
  unregistered: { label: "unregistered", c: color.shu },
};

/** A stand-in for the /name/[fqn] ledger panel — used as a recurring visual anchor. */
export function NameCard({
  fqn,
  status,
  children,
}: {
  fqn: string;
  status: keyof typeof STATUS_STYLE;
  children?: React.ReactNode;
}) {
  const s = STATUS_STYLE[status];
  return (
    <div
      style={{
        border: `1px solid ${color.inkLine}`,
        background: "rgba(18,21,29,0.6)",
        padding: "28px 34px",
        minWidth: 480,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontFamily: font.display, fontSize: 40, color: color.washi }}>{fqn}</span>
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 14,
            color: s.c,
            border: `1px solid ${s.c}66`,
            padding: "3px 10px",
          }}
        >
          {s.label}
        </span>
      </div>
      {children}
    </div>
  );
}

/** A Telegram-style outbound alert bubble, avatar-branded with the tower mark. */
export function AlertBubble({ text, opacity = 1 }: { text: string; opacity?: number }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", opacity }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: color.inkRaised,
          border: `1px solid ${color.inkLine}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Tower height={30} lineColor={color.washiDim} />
      </div>
      <div
        style={{
          background: color.inkRaised,
          border: `1px solid ${color.inkLine}`,
          padding: "18px 22px",
          maxWidth: 520,
          fontFamily: font.sans,
          fontSize: 22,
          lineHeight: 1.5,
          color: color.washi,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** The site's CTA button styling, reused verbatim (bg-shu / border-shu, mono). */
export function CtaButton({ children, pressed = false }: { children: React.ReactNode; pressed?: boolean }) {
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: font.mono,
        fontSize: 20,
        padding: "16px 30px",
        border: `1px solid ${color.shu}`,
        background: pressed ? "transparent" : color.shu,
        color: pressed ? color.shu : color.ink,
        transform: pressed ? "scale(0.97)" : "scale(1)",
      }}
    >
      {children}
    </div>
  );
}
