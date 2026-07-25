// Same font files apps/web vendors via @fontsource — no network fetch, so
// no CDN round-trip for Remotion's headless Chrome to wait on.
//
// Deliberately NOT gating on document.fonts.ready via delayRender here:
// tried it, and under concurrent multi-page rendering (multiple worker
// tabs sharing 4 CPU cores) that promise would occasionally hang well past
// a 90s timeout and fail the whole render, even though every still-frame
// render — before and after removing this gate — shows the real fonts
// correctly. Whatever Remotion already does to ready a page before
// capturing frame 0 is sufficient for these locally-bundled files.
import "@fontsource/shippori-mincho/500.css";
import "@fontsource/shippori-mincho/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
