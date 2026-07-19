import { YaguraBnsClient } from "@yagura/core";
import { createDb } from "@yagura/core/db";

import { createBot, telegramSenderFromBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { buildEmailProvider } from "./email.js";
import { drainAlerts, type TelegramSender } from "./notifier.js";
import { runPollCycle } from "./poller.js";
import { interruptibleSleep } from "./util.js";

/**
 * Worker entrypoint: migrate the database, start the Telegram bot (when a
 * token is configured), then poll + deliver forever on the configured
 * interval. Cycles never overlap and SIGINT/SIGTERM stop cleanly.
 */

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const handle = await createDb(config.databaseUrl);
  await handle.migrate();

  const bns = new YaguraBnsClient({
    bnsApi: config.bnsApiBase ? { baseUrl: config.bnsApiBase } : {},
    hiro: {
      ...(config.hiroApiBase ? { baseUrl: config.hiroApiBase } : {}),
      ...(config.hiroApiKey ? { apiKey: config.hiroApiKey } : {}),
    },
  });
  const email = buildEmailProvider(config);

  let telegram: TelegramSender | undefined;
  let stopBot: (() => Promise<void>) | undefined;
  if (config.telegramBotToken) {
    const bot = createBot(config.telegramBotToken, { db: handle.db, bns, email });
    telegram = telegramSenderFromBot(bot);
    // Long polling runs alongside the poll loop; grammY resolves start()
    // only on stop, so it is deliberately not awaited.
    void bot.start({
      onStart: (me) => console.log(`[bot] @${me.username} listening`),
    });
    stopBot = () => bot.stop();
  } else {
    console.log("[bot] YAGURA_TELEGRAM_BOT_TOKEN not set — Telegram disabled");
  }

  const shutdown = new AbortController();
  const stop = (signal: string): void => {
    console.log(`${signal} received — finishing current cycle and exiting`);
    shutdown.abort();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  console.log(
    `yagura worker up — polling every ${config.pollIntervalMs / 60000} min`,
  );
  while (!shutdown.signal.aborted) {
    const startedAt = Date.now();
    try {
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
        `[cycle] ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ` +
          `${poll.namesResolved} names refreshed (${poll.nameFailures} failed), ` +
          `${poll.alertsEnqueued} enqueued, ${notify.delivered} delivered, ` +
          `${notify.retained} retained for retry`,
      );
    } catch (error) {
      // A whole-cycle failure (e.g. DB hiccup) is logged and retried next
      // interval — the worker must outlive transient infrastructure trouble.
      console.error(`[cycle] failed: ${String(error)}`);
    }
    const elapsed = Date.now() - startedAt;
    await interruptibleSleep(
      Math.max(5_000, config.pollIntervalMs - elapsed),
      shutdown.signal,
    );
  }

  await stopBot?.();
  await handle.close();
  console.log("yagura worker stopped");
}

main().catch((error) => {
  console.error(`fatal: ${String(error)}`);
  process.exit(1);
});
