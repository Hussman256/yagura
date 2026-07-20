# @yagura/web

The Yagura web app (Next.js App Router + Tailwind): landing with live
counters, wallet-connect dashboard, public `/name/[fqn]` status pages, the
`/renew/[fqn]` one-tap renewal deep-link (deny-mode STX-burn
post-condition), public `/metrics`, and `/unsubscribe`.

Deploys on Vercel with **Root Directory** set to `apps/web`. Runs without a
database for all chain pages; point `YAGURA_DATABASE_URL` at the worker's
Postgres (a real `postgres://` URL — PGlite is worker-only) to light up
metrics and unsubscribe.
