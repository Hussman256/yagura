# Yagura（櫓）

**The watchtower for your BNS names. Never lose the one you own. Never miss the one you want.**

A *yagura* is the lookout tower on a Japanese castle — built to spot danger while
there is still time to act. This Yagura watches the
[Bitcoin Name System](https://docs.stacks.co/learn/network-fundamentals/bitcoin-name-system)
on Stacks and does exactly two things, excellently:

- **Expiry alerts (defensive).** Register your Stacks address or connect a wallet,
  and get Telegram/email warnings ~30 / 7 / 1 days before any of your BNS names
  expire — and again during the grace period. Every alert carries a one-tap
  renewal deep-link that opens your wallet (Leather/Xverse) with the correct
  `name-renewal` contract call pre-filled.
- **Availability watch (offensive).** Watch any name you want. The first poll
  after it becomes acquirable again, you get pinged with a registration link.

Yagura is the push-based notification layer that complements
[BNS One](https://bns.one)'s dashboard — we alert, they (and your wallet) handle
registration. MIT-licensed, cheap to run, no paid infra required.

## BNS V2 facts this code relies on

All verified live on 2026-07-19 against the deployed contract source and
on-chain reads — see `packages/core/src/constants.ts`:

| Fact | Value |
| --- | --- |
| Mainnet contract | `SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF.BNS-V2` (names are SIP-09 NFTs) |
| Expiry unit | Bitcoin **burn block heights** (dates shown are estimates at ~10 min/block, recomputed every poll) |
| Grace period | `5000` burn blocks (~34.7 days), global constant, owner-only renewal window |
| After grace | The name is immediately acquirable by **anyone** via `name-renewal` — there is no separate re-registration flow for expired names |
| Renewal entrypoint | `(name-renewal (namespace (buff 20)) (name (buff 48)))` — the contract computes the price (`get-name-price`) and burns it from the caller |
| `.btc` lifetime | 262,800 blocks (~5 years) |
| `.id` lifetime | 52,595 blocks (~1 year) |
| `.stx`, `.app` | lifetime 0 — **never expire** |
| Managed namespaces (e.g. `.mega`, `.sats`) | lifetime 0 + manager contract — renewals live outside BNS-V2; treated as non-expiring |
| Imported names | `renewal-height` 0 means expiry = namespace `launched-at` + lifetime |

Namespace lifetimes are read from the chain at runtime, never hardcoded — the
table above is documentation, not configuration.

## Monorepo layout

```
packages/core   @yagura/core   BNS client, status derivation, block-time estimation,
                               alert rules, Drizzle schema, CLI. Phases 1–2 — done.
apps/worker     @yagura/worker Poller + alert engine + Telegram bot + pluggable
                               email delivery. Phases 2–3 — done.
apps/web        @yagura/web    Next.js app: dashboard, /name/[fqn], /renew/[name],
                               /metrics. Phase 4 — pending.
```

**Database:** Postgres everywhere, via Drizzle. Production points
`YAGURA_DATABASE_URL` at any managed/free-tier Postgres; local dev and tests
run [PGlite](https://pglite.dev) (real Postgres compiled to WASM, in-process)
with zero setup — same schema, same SQL, no dialect drift. Migrations live in
`packages/core/drizzle` and are applied automatically on worker boot.

The worker polls every 10 minutes (configurable): it discovers names owned by
tracked addresses, refreshes on-chain state, detects ownership changes
("you no longer own X" — once, then expiry alerts stop), and enqueues due
alert tiers into the `alerts_sent` ledger, whose unique index makes
double-sending impossible. A failed fetch is always "no new information" —
never "the name is gone", and never an availability alert.

**Notifications.** After each poll the notifier drains the queue through every
live channel a user has: Telegram (grammY bot, long polling) and email behind
a pluggable provider interface (Resend implemented; `console` provider for
dev). Emails go only to verified addresses (6-digit code via the bot's
`/verify`), and every mail carries an unsubscribe link + `List-Unsubscribe`
header. Dead channels heal themselves: a blocked bot or hard-bounced address
flips the channel off; talking to the bot again turns it back on.

**Telegram bot commands:**
`/start` · `/address SP…` (monitor an address) · `/track name.btc`
(auto-detects own vs want, asks if unsure) · `/watch name.btc` ·
`/status name.btc` (instant lookup) · `/list` · `/untrack name.btc` ·
`/email you@example.com` + `/verify CODE`

Data sources: the [BNS V2 indexer API](https://api.bnsv2.com) (by Strata Labs,
the same API behind `bns-v2-sdk`) as the primary read path, and the
[Hiro Stacks Blockchain API](https://docs.hiro.so) for burn height, prices, and
direct contract reads. Both endpoints and an optional Hiro API key are
env-configurable (`YAGURA_*`, see `.env.example`).

## Quickstart (dev)

```bash
pnpm install
pnpm build                # build packages (worker imports core's dist)
pnpm test                 # core units (fixtures) + worker integration (PGlite)
pnpm bns status muneeb.btc    # live mainnet lookup
pnpm bns names SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF
pnpm bns price muneeb.btc     # renewal burn price in STX

# run the watchtower locally (embedded DB, live mainnet):
cd apps/worker
pnpm ops add-user                      # → prints a user id
pnpm ops track-address <id> SP...      # defensive: monitor an address
pnpm ops track-name <id> rare.btc want # offensive: watch a name
pnpm ops run-once && pnpm ops alerts   # one poll cycle, inspect the queue
pnpm dev                               # poll forever
```

## Design rules

- **Availability alerts are high-precision.** A name is only ever reported
  "available" from definitive on-chain numbers; ambiguous data or failed
  fetches produce `unknown` and no alert. A false "it's free!" ping is the one
  mistake a watchtower cannot make.
- **Block heights are the source of truth.** Wall-clock dates are derived for
  display only and recomputed on every poll.
- **Every alert tier fires at most once** per (user, name) — enforced by the
  `alerts_sent` ledger, decided by pure functions in `@yagura/core`.

---

*Built with support from Stacks DeGrants (placeholder).*
