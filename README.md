# Yagura（櫓）

**The watchtower for your BNS names. Never lose the one you own. Never miss the one you want.**

A *yagura* is the lookout tower on a Japanese castle — built so danger is seen
while there is still time to act. This Yagura watches the
[Bitcoin Name System](https://docs.stacks.co/learn/network-fundamentals/bitcoin-name-system)
on Stacks and does two things, excellently:

- **Expiry alerts (defensive).** Tell it your Stacks address — or connect a
  wallet — and every BNS name you own is monitored. You get Telegram/email
  warnings ~30, 7 and 1 days before expiry, again when the grace period
  starts, and once more halfway through it. Every alert carries a one-tap
  renewal link that opens your wallet with the correct `name-renewal`
  contract call pre-filled and the STX burn pinned by a post-condition.
- **Availability watch (offensive).** Watch any name someone else holds.
  The first poll after it becomes claimable again, you get pinged with a
  registration link.

Yagura is the push-based notification layer that complements
[BNS One](https://bns.one)'s dashboard — we alert, they handle registration.
MIT licensed, built to run on free tiers.

> **Status:** feature-complete MVP (monitor + alert + one-tap renew).
> Screenshots: *pending first hosted deployment.*

## Architecture

```
                        ┌───────────────────────────────┐
   Hiro Stacks API ◄────┤  apps/worker                  │
   BNS V2 indexer  ◄────┤  poll every 10 min:           │
   (api.bnsv2.com)      │  discover → refresh state →   │
                        │  owner changes → enqueue      │────► Telegram (grammY)
                        │  then drain alert queue       │────► Email (Resend/console)
                        └──────────────┬────────────────┘
                                       │ Drizzle ORM
                        ┌──────────────▼────────────────┐
                        │  Postgres                     │
                        │  users · tracked_addresses ·  │
                        │  tracked_names · name_state · │
                        │  alerts_sent (ledger+queue)   │
                        └──────────────▲────────────────┘
                                       │ read-only-ish
                        ┌──────────────┴────────────────┐
   Hiro Stacks API ◄────┤  apps/web (Next.js)           │
   wallet (Leather/ ◄───┤  landing · dashboard ·        │
   Xverse via           │  /name/[fqn] · /renew/[fqn] · │
   @stacks/connect)     │  /metrics · /unsubscribe      │
                        └───────────────────────────────┘
              shared logic: packages/core (@yagura/core)
   BNS client · status rules · block-time · alert tiers · DB schema
```

## BNS V2 facts this code relies on

All verified live against the deployed mainnet contract source and on-chain
reads (2026-07-19) — see `packages/core/src/constants.ts`:

| Fact | Value |
| --- | --- |
| Mainnet contract | `SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF.BNS-V2` (names are SIP-09 NFTs) |
| Expiry unit | Bitcoin **burn block heights** (dates shown are estimates at ~10 min/block, recomputed every poll) |
| Grace period | `5000` burn blocks (~34.7 days), global constant, owner-only renewal window |
| After grace | The name is immediately acquirable by **anyone** via `name-renewal` — there is no separate re-registration flow |
| Renewal entrypoint | `(name-renewal (namespace (buff 20)) (name (buff 48)))` — the contract computes the price (`get-name-price`) and burns it from the caller |
| `.btc` lifetime | 262,800 blocks (~5 years) |
| `.id` lifetime | 52,595 blocks (~1 year) |
| `.stx`, `.app` | lifetime 0 — **never expire** |
| Managed namespaces (e.g. `.mega`, `.sats`) | lifetime 0 + manager contract — renewals live outside BNS-V2; treated as non-expiring |
| Imported names | `renewal-height` 0 means expiry = namespace `launched-at` + lifetime |

Namespace lifetimes are read from the chain at runtime — the table is
documentation, not configuration.

## Monorepo

```
packages/core   @yagura/core   BNS client, status derivation, block-time estimation,
                               alert-tier rules, Drizzle schema, dev CLI
apps/worker     @yagura/worker Poller + alert engine + Telegram bot + email delivery
apps/web        @yagura/web    Next.js app: landing, wallet dashboard, /name/[fqn],
                               /renew/[fqn], /metrics, /unsubscribe
```

**Database.** Postgres everywhere, via Drizzle. Production points
`YAGURA_DATABASE_URL` at any managed Postgres; the worker's local dev and all
tests use [PGlite](https://pglite.dev) (real Postgres compiled to WASM,
in-process) with zero setup — same schema, same SQL, no dialect drift.
Migrations ship in `packages/core/drizzle` and apply automatically on worker
boot. (The web app needs a real `postgres://` URL for metrics/unsubscribe;
without one it serves its chain-only pages happily.)

**Reliability rules.** A failed fetch is "no new information" — never "the
name is gone", and never an availability alert; ambiguous chain data derives
status `unknown`, which never alerts. Every alert tier fires at most once per
(user, name), enforced by a unique index on the `alerts_sent` ledger — the
same table doubles as the outbound queue and the metrics source. Dead
channels stop deliveries (blocked bot, bounced email) and revive when the
user returns.

## Quickstart (dev)

```bash
pnpm install
pnpm build                # core first — worker/web import its dist
pnpm test                 # core units (fixtures) + worker integration (PGlite)

pnpm bns status muneeb.btc    # live mainnet lookup from the CLI
pnpm bns price muneeb.btc     # renewal burn price

# run the watchtower with an embedded database:
cd apps/worker
pnpm ops add-user                       # → prints a user id
pnpm ops track-address <id> SP...       # defensive: monitor an address
pnpm ops track-name <id> rare.btc want  # offensive: watch a name
pnpm ops run-once && pnpm ops alerts    # one poll cycle, inspect the queue
pnpm dev                                # poll forever (+ bot if token set)

# run the web app:
cd apps/web && pnpm dev                 # http://localhost:3000
```

**Telegram bot:** `/start` · `/address SP…` · `/track name.btc` (auto-detects
own vs want) · `/watch name.btc` · `/status name.btc` · `/list` ·
`/untrack name.btc` · `/email you@example.com` + `/verify CODE`

## Self-hosting (one documented path: Railway + Vercel)

The worker and database live on [Railway](https://railway.app); the web app
on [Vercel](https://vercel.com). Both have hobby tiers that fit Yagura.

1. Fork/clone this repo and push it to your GitHub.
2. Create a Telegram bot with [@BotFather](https://t.me/BotFather); note the
   token and the bot's username.
3. (Optional) Create a [Resend](https://resend.com) API key and verified
   sender for email alerts — skip to run Telegram-only.
4. On Railway: **New Project → Deploy Postgres**, then **New Service → GitHub
   repo**, and set the service's Dockerfile path to `apps/worker/Dockerfile`.
5. Give the worker service these variables:
   `YAGURA_DATABASE_URL` = Railway's `DATABASE_URL` reference,
   `YAGURA_TELEGRAM_BOT_TOKEN`, `YAGURA_WEB_BASE_URL` (your web URL),
   and for email: `YAGURA_EMAIL_PROVIDER=resend`, `YAGURA_RESEND_API_KEY`,
   `YAGURA_EMAIL_FROM`. Deploy — migrations run on boot.
6. On Vercel: import the repo, set **Root Directory** to `apps/web`
   (Vercel detects Next.js + pnpm workspaces automatically).
7. Give the web app `YAGURA_DATABASE_URL` (same Postgres, for
   metrics/unsubscribe) and `YAGURA_TELEGRAM_BOT_USERNAME`.
8. Deploy, then message your bot `/start`. Done — the tower is watching.

An optional Hiro API key (`YAGURA_HIRO_API_KEY`, free at platform.hiro.so)
raises rate limits; the public tier is fine for hundreds of names.

## What Yagura deliberately is not

No marketplace, no valuations, no registration flow (BNS One does that
well), no mobile app, no paid tiers. Monitor + alert + one-tap renew, done
carefully.

---

*Built with support from Stacks DeGrants (placeholder).*
