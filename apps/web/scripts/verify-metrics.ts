/**
 * Dev check: proves the metrics SQL in lib/metrics.ts runs on real Postgres
 * semantics (PGlite in plain Node — the same engine, unbundled).
 *
 *   pnpm dlx tsx scripts/verify-metrics.ts   (or npx tsx from apps/web)
 */
import {
  alertsSent,
  createDb,
  nameState,
  trackedNames,
  users,
} from "@yagura/core/db";

import { computeMetrics } from "../lib/metrics";

async function main() {
const handle = await createDb("pglite://memory");
await handle.migrate();
const db = handle.db;

// One rescued name (grace alert delivered, active again), one suppressed
// tier (must not count), one availability watch.
const [user] = await db.insert(users).values({ telegramChatId: "1" }).returning();
await db.insert(nameState).values({
  fqn: "saved.btc",
  name: "saved",
  namespace: "btc",
  owner: "SP1X",
  renewalHeight: 1_200_000,
  lifetime: 262_800,
  status: "active",
  currentBurnBlock: 958_000,
});
await db.insert(trackedNames).values({ userId: user!.id, fqn: "prize.btc", mode: "want" });
await db.insert(alertsSent).values([
  {
    userId: user!.id,
    fqn: "saved.btc",
    alertType: "grace-started",
    suppressed: false,
    deliveredAt: new Date("2026-07-01"),
    createdAt: new Date("2026-07-01"),
  },
  {
    userId: user!.id,
    fqn: "saved.btc",
    alertType: "expiry-30d",
    suppressed: true,
    createdAt: new Date("2026-06-20"),
  },
]);

const metrics = await computeMetrics(db);
console.log(JSON.stringify(metrics, null, 2));

const expected = { namesMonitored: 1, alertsDelivered: 1, namesRescued: 1, watchesActive: 1 };
for (const [key, value] of Object.entries(expected)) {
  const actual = metrics[key as keyof typeof expected];
  if (actual !== value) {
    console.error(`FAIL: ${key} = ${actual}, expected ${value}`);
    process.exit(1);
  }
}
console.log("metrics SQL verified OK");
await handle.close();
}

void main();
