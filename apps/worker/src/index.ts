import { YaguraBnsClient } from "@yagura/core";
import { createDb } from "@yagura/core/db";

import { loadConfig } from "./config.js";
import { runPollCycle } from "./poller.js";
import { interruptibleSleep } from "./util.js";

/**
 * Worker entrypoint: migrate the database, then poll forever on the
 * configured interval. Cycles never overlap (the next sleep starts only
 * after the previous cycle finishes) and SIGINT/SIGTERM stop cleanly.
 *
 * Phase 3 adds the notifier (drains undelivered alerts) and the Telegram
 * bot alongside this loop.
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
      const stats = await runPollCycle(handle.db, bns, {
        log: (message) => console.log(`[poll] ${message}`),
      });
      console.log(
        `[poll] cycle done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ` +
          `${stats.namesResolved} names refreshed (${stats.nameFailures} failed), ` +
          `${stats.alertsEnqueued} alerts enqueued, ` +
          `${stats.ownershipChanges} ownership changes`,
      );
    } catch (error) {
      // A whole-cycle failure (e.g. DB hiccup) is logged and retried next
      // interval — the worker must outlive transient infrastructure trouble.
      console.error(`[poll] cycle failed: ${String(error)}`);
    }
    const elapsed = Date.now() - startedAt;
    await interruptibleSleep(
      Math.max(5_000, config.pollIntervalMs - elapsed),
      shutdown.signal,
    );
  }

  await handle.close();
  console.log("yagura worker stopped");
}

main().catch((error) => {
  console.error(`fatal: ${String(error)}`);
  process.exit(1);
});
