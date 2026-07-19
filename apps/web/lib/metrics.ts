import { alertsSent, nameState, trackedNames, type YaguraDb } from "@yagura/core/db";
import { and, countDistinct, eq, isNotNull, sql } from "drizzle-orm";

import { getDb } from "./db";

/**
 * Public metrics, read straight from the operational tables — real numbers,
 * not vanity. All queries tolerate an empty database (fresh deploys show
 * honest zeros) and the whole module degrades to null when no database is
 * configured.
 */

export interface PublicMetrics {
  /** Distinct names Yagura currently keeps state for. */
  namesMonitored: number;
  /** Alerts actually delivered to a human (suppressed/dropped don't count). */
  alertsDelivered: number;
  /** Names that entered the grace period on our watch and are active again. */
  namesRescued: number;
  /** Active availability watches. */
  watchesActive: number;
  /** Delivered alerts per ISO week, oldest → newest (up to 8 weeks). */
  weeklyAlerts: Array<{ week: string; count: number }>;
}

export async function getPublicMetrics(): Promise<PublicMetrics | null> {
  const handlePromise = getDb();
  if (!handlePromise) return null;
  const { db } = await handlePromise;
  return computeMetrics(db);
}

/** Separated from getDb so the SQL is testable against any Postgres handle. */
export async function computeMetrics(db: YaguraDb): Promise<PublicMetrics> {
  const [monitored] = await db
    .select({ value: countDistinct(nameState.fqn) })
    .from(nameState);

  const [delivered] = await db
    .select({ value: countDistinct(alertsSent.id) })
    .from(alertsSent)
    .where(and(eq(alertsSent.suppressed, false), isNotNull(alertsSent.deliveredAt)));

  // "Rescued": a grace alert went out and the name is active again today —
  // i.e. the watchtower shouted and somebody renewed in time.
  const [rescued] = await db
    .select({ value: countDistinct(alertsSent.fqn) })
    .from(alertsSent)
    .innerJoin(nameState, eq(alertsSent.fqn, nameState.fqn))
    .where(
      and(
        sql`${alertsSent.alertType} in ('grace-started', 'grace-half')`,
        isNotNull(alertsSent.deliveredAt),
        eq(alertsSent.suppressed, false),
        eq(nameState.status, "active"),
      ),
    );

  const [watches] = await db
    .select({ value: countDistinct(trackedNames.id) })
    .from(trackedNames)
    .where(and(eq(trackedNames.mode, "want"), eq(trackedNames.active, true)));

  const weekly = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${alertsSent.createdAt}), 'YYYY-MM-DD')`,
      count: countDistinct(alertsSent.id),
    })
    .from(alertsSent)
    .where(and(eq(alertsSent.suppressed, false), isNotNull(alertsSent.deliveredAt)))
    .groupBy(sql`date_trunc('week', ${alertsSent.createdAt})`)
    .orderBy(sql`date_trunc('week', ${alertsSent.createdAt})`);

  return {
    namesMonitored: monitored?.value ?? 0,
    alertsDelivered: delivered?.value ?? 0,
    namesRescued: rescued?.value ?? 0,
    watchesActive: watches?.value ?? 0,
    weeklyAlerts: weekly.slice(-8).map((row) => ({ week: row.week, count: row.count })),
  };
}
