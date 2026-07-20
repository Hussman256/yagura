# @yagura/worker

The Yagura watchtower process: polls tracked names/addresses every 10
minutes, refreshes `name_state`, detects ownership changes, enqueues due
alert tiers idempotently, then delivers them via the Telegram bot (grammY)
and pluggable email (Resend or console). Applies database migrations on
boot.

Deployed as a native Node Background Worker on Render — see `render.yaml`
at the repo root. Local dev: `pnpm dev` (embedded PGlite database, console
email, no credentials needed); `pnpm ops` for seeding and inspection.
