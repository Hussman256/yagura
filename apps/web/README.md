# @yagura/web

The Yagura web app (Next.js App Router + Tailwind): landing with live
counters, wallet-connect dashboard, public `/name/[fqn]` status pages, the
`/renew/[fqn]` one-tap renewal deep-link (deny-mode STX-burn
post-condition), public `/metrics`, and `/unsubscribe`.

Deploys on Vercel with **Root Directory** set to `apps/web`. Runs without a
database for all chain pages; point `YAGURA_DATABASE_URL` at the shared
Neon Postgres (a real `postgres://` URL — PGlite is dev-only) to light up
metrics and unsubscribe.

Also hosts the Telegram bot's **webhook route**
(`app/api/telegram/webhook`, from `@yagura/bot`) — inbound commands
(`/track`, `/status`, `/email`, …) are answered here, serverless, instead of
by a long-polling process. The GitHub Actions poller only ever sends
outbound alerts through the same bot token; see the root README's
self-hosting section for the full three-service split.
