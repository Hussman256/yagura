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
                               alert rules, CLI. Phase 1 — done.
apps/worker     @yagura/worker Poller + alert engine + Telegram bot. Phase 2–3 — pending.
apps/web        @yagura/web    Next.js app: dashboard, /name/[fqn], /renew/[name],
                               /metrics. Phase 4 — pending.
```

Data sources: the [BNS V2 indexer API](https://api.bnsv2.com) (by Strata Labs,
the same API behind `bns-v2-sdk`) as the primary read path, and the
[Hiro Stacks Blockchain API](https://docs.hiro.so) for burn height, prices, and
direct contract reads. Both endpoints and an optional Hiro API key are
env-configurable (`YAGURA_*`, see `.env.example`).

## Quickstart (dev)

```bash
pnpm install
pnpm test                 # unit tests (recorded fixtures, no network)
pnpm bns status muneeb.btc    # live mainnet lookup
pnpm bns names SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF
pnpm bns price muneeb.btc     # renewal burn price in STX
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
