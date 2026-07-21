#!/usr/bin/env tsx
/**
 * Minimal ops CLI for local development and self-hosting — the only "admin
 * panel" Yagura has. Talks straight to the configured database.
 *
 *   pnpm ops add-user                          → create a user, print its id
 *   pnpm ops track-address <userId> <SP...>    → monitor an address ('own')
 *   pnpm ops track-name <userId> <fqn> <mode>  → track one name (own|want)
 *   pnpm ops run-once                          → one live poll cycle
 *   pnpm ops notify-once                       → drain the alert queue once
 *   pnpm ops state                             → dump name_state
 *   pnpm ops alerts                            → dump the alert ledger/queue
 */
import { YaguraBnsClient } from "@yagura/core";
import {
  alertsSent,
  createDb,
  nameState,
  trackedAddresses,
  trackedNames,
  users,
} from "@yagura/core/db";

import { buildEmailProvider, drainAlerts, telegramSenderFromBot } from "@yagura/bot";
import { Bot } from "grammy";

import { loadConfig } from "./config.js";
import { runPollCycle } from "./poller.js";

const config = loadConfig(process.env);
const handle = await createDb(config.databaseUrl);
await handle.migrate();
const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "add-user": {
      const [row] = await handle.db.insert(users).values({}).returning();
      console.log(row!.id);
      break;
    }
    case "track-address": {
      const [userId, stacksAddress] = args;
      if (!userId || !stacksAddress) throw new Error("usage: track-address <userId> <SP...>");
      await handle.db
        .insert(trackedAddresses)
        .values({ userId, stacksAddress })
        .onConflictDoNothing();
      console.log(`tracking all names owned by ${stacksAddress}`);
      break;
    }
    case "track-name": {
      const [userId, fqn, mode] = args;
      if (!userId || !fqn || (mode !== "own" && mode !== "want")) {
        throw new Error("usage: track-name <userId> <name.namespace> <own|want>");
      }
      await handle.db
        .insert(trackedNames)
        .values({ userId, fqn: fqn.toLowerCase(), mode })
        .onConflictDoNothing();
      console.log(`tracking ${fqn} (${mode})`);
      break;
    }
    case "run-once": {
      const bns = new YaguraBnsClient({
        bnsApi: config.bnsApiBase ? { baseUrl: config.bnsApiBase } : {},
        hiro: {
          ...(config.hiroApiBase ? { baseUrl: config.hiroApiBase } : {}),
          ...(config.hiroApiKey ? { apiKey: config.hiroApiKey } : {}),
        },
      });
      const stats = await runPollCycle(handle.db, bns, { log: console.log });
      console.log(JSON.stringify(stats, null, 2));
      break;
    }
    case "notify-once": {
      const email = buildEmailProvider(config);
      const telegram = config.telegramBotToken
        ? telegramSenderFromBot(new Bot(config.telegramBotToken))
        : undefined;
      const stats = await drainAlerts(handle.db, {
        email,
        telegram,
        webBaseUrl: config.webBaseUrl,
        log: console.log,
      });
      console.log(JSON.stringify(stats, null, 2));
      break;
    }
    case "state": {
      for (const row of await handle.db.select().from(nameState)) {
        console.log(
          `${row.fqn.padEnd(32)} ${row.status.padEnd(12)} renewal=${row.renewalHeight ?? "∞"} owner=${row.owner ?? "—"}`,
        );
      }
      break;
    }
    case "alerts": {
      for (const row of await handle.db.select().from(alertsSent)) {
        console.log(
          `${row.fqn.padEnd(32)} ${row.alertType.padEnd(14)} suppressed=${row.suppressed} delivered=${row.deliveredAt?.toISOString() ?? "queued"}`,
        );
      }
      break;
    }
    default:
      throw new Error(
        "usage: pnpm ops <add-user|track-address|track-name|run-once|notify-once|state|alerts>",
      );
  }
} finally {
  await handle.close();
}
