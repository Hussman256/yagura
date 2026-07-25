/**
 * Mirrors apps/web/app/globals.css's dark "watchtower at night" palette
 * exactly (hex-for-hex) — the video is one more surface for the same
 * identity, not a new one.
 */
export const color = {
  ink: "#0b0d12",
  inkDeep: "#06070a",
  inkRaised: "#12151d",
  inkLine: "#232838",
  washi: "#e9e4d6",
  washiDim: "#8f8b7e",
  shu: "#e5484d",
  moss: "#6fbf8b",
  amber: "#d9a441",
} as const;

// Fonts ship with the repo via @fontsource (see fonts.ts) — same reason
// as apps/web: this machine can't reach fonts.gstatic.com at build/render
// time, so @remotion/google-fonts' CDN-backed loader isn't an option here.
export const font = {
  display: '"Shippori Mincho", "Yu Mincho", serif',
  sans: '"IBM Plex Sans", sans-serif',
  mono: '"IBM Plex Mono", monospace',
};
