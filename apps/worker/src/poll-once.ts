#!/usr/bin/env node
/**
 * Single-shot poll cycle — the production entrypoint, run by the GitHub
 * Actions workflow (`.github/workflows/poll.yml`) on a 10-minute cron
 * schedule against the Neon database. Each run: connects, applies any
 * pending migrations, refreshes state, enqueues due alerts, drains the
 * queue through Telegram + email, then exits. No long-lived process, no
 * in-memory state to lose between runs — GitHub Actions owns the cadence.
 *
 * Telegram delivery uses a bare Bot instance's `.api` to send messages; it
 * is never started or webhooked here — inbound commands are handled by the
 * Vercel webhook route (`apps/web/app/api/telegram/webhook`), a completely
 * separate process from this script.
 *
 * Exits 0 on success (even if some alerts were only partially delivered —
 * that's tracked in retained/dropped stats, not a script failure) and 1 on
 * an unhandled error, which fails the GitHub Actions run and surfaces in the
 * repo's Actions tab as a visible signal that the watchtower stopped seeing.
 */
import { YaguraBnsClient } from "@yagura/core";
import { createDb } from "@yagura/core/db";
import {
  buildEmailProvider,
  clearExpiredPendingTracks,
  drainAlerts,
  telegramSenderFromBot,
  type TelegramSender,
} from "@yagura/bot";
import { Bot } from "grammy";

import { loadConfig } from "./config.js";
import { runPollCycle } from "./poller.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const handle = await createDb(config.databaseUrl);
  try {
    await handle.migrate();

    const bns = new YaguraBnsClient({
      bnsApi: config.bnsApiBase ? { baseUrl: config.bnsApiBase } : {},
      hiro: {
        ...(config.hiroApiBase ? { baseUrl: config.hiroApiBase } : {}),
        ...(config.hiroApiKey ? { apiKey: config.hiroApiKey } : {}),
      },
    });
    const email = buildEmailProvider(config);
    const telegram: TelegramSender | undefined = config.telegramBotToken
      ? telegramSenderFromBot(new Bot(config.telegramBotToken))
      : undefined;
    if (!telegram) {
      console.log("YAGURA_TELEGRAM_BOT_TOKEN not set — Telegram delivery disabled");
    }

    await clearExpiredPendingTracks(handle.db);

    const poll = await runPollCycle(handle.db, bns, {
      log: (message) => console.log(`[poll] ${message}`),
    });
    const notify = await drainAlerts(handle.db, {
      email,
      telegram,
      webBaseUrl: config.webBaseUrl,
      log: (message) => console.log(`[notify] ${message}`),
    });

    console.log(
      `[cycle] ${poll.namesResolved} names refreshed (${poll.nameFailures} failed), ` +
        `${poll.ownershipChanges} ownership changes, ${poll.alertsEnqueued} alerts enqueued, ` +
        `${notify.delivered} delivered, ${notify.retained} retained for retry, ` +
        `${notify.dropped} dropped (no live channel)`,
    );
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(`fatal: ${String(error)}`);
  process.exit(1);
});
