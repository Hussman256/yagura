# @yagura/worker

The Yagura watchtower's poll cycle: refreshes `name_state` for every
tracked name/address, detects ownership changes, enqueues due alert tiers
idempotently, then drains the delivery queue through the Telegram bot's
outbound API and pluggable email (Resend or console). Applies database
migrations at the start of every run.

Ships as a **single-shot script** (`src/poll-once.ts`), not a long-running
process — production runs it on a 10-minute cron via
`.github/workflows/poll.yml`, against a [Neon](https://neon.tech) Postgres
database. There is no server to host or keep alive for this piece.

Inbound Telegram commands are handled elsewhere: `packages/bot`'s webhook
handler, mounted as a Vercel API route in `apps/web`. This app only ever
sends.

Local dev: `pnpm ops` for seeding and inspection (embedded PGlite database,
console email, no credentials needed); `pnpm poll` to run one cycle by hand.
