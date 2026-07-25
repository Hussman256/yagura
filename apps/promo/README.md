# @yagura/promo

Remotion source for Yagura's 24-second promo video (1920×1080, 30fps). Not
part of the shipped product — this package only produces `out/promo.mp4`,
which is gitignored; re-render it locally when you need the file.

Reuses the web app's identity directly: same hex palette as
`apps/web/app/globals.css` (`src/theme.ts`), same fonts vendored the same
way via `@fontsource` (`src/fonts.ts`) rather than `@remotion/google-fonts`,
because this machine can't reach `fonts.gstatic.com` at build/render time —
same constraint the web app hit first.

Seven scenes, stitched with a 12-frame crossfade in `src/Promo.tsx`: cold
open (tower draws on, beacon lights) → tagline → the problem (a name's
watch-fire burns from calm to urgent) → an alert arrives → one-tap renew →
availability watch → outro (mark + links).

```bash
pnpm --filter @yagura/promo studio   # interactive preview/scrubber
pnpm --filter @yagura/promo render   # -> out/promo.mp4
pnpm --filter @yagura/promo still    # single frame, e.g. --frame=150
```

**Note on font loading:** don't add a `delayRender`/`document.fonts.ready`
gate in `fonts.ts` — it was tried, and under concurrent multi-page
rendering on a low-core machine that promise intermittently hangs past a
90s timeout and fails the whole render, even though the fonts render
correctly without it (verified frame-by-frame across every scene).
