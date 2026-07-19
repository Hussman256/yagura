import {
  bigint,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Yagura database schema (Postgres, via Drizzle).
 *
 * Design notes:
 * - Block heights are bigints (Bitcoin heights fit in a JS number today, but
 *   the column type should not be the thing that breaks in 100 years).
 * - `name_state` stores heights and status only — wall-clock estimates are
 *   recomputed from the live burn height at display/alert time, never stored.
 * - `alerts_sent` is both the idempotency ledger (a unique index makes
 *   double-sending impossible even across racing pollers) and the outbound
 *   queue (rows with `delivered_at` null and `suppressed` false are what the
 *   Phase 3 notifier picks up). It also feeds the public metrics counters.
 */

export const trackModeEnum = pgEnum("track_mode", ["own", "want"]);

export const trackSourceEnum = pgEnum("track_source", [
  /** Added explicitly by the user (bot command / dashboard). */
  "manual",
  /** Auto-discovered because the user tracks the owning address. */
  "discovered",
]);

export const nameStatusEnum = pgEnum("name_status", [
  "active",
  "grace",
  "available",
  "nonexpiring",
  "unregistered",
  "unknown",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "expiry-30d",
  "expiry-7d",
  "expiry-1d",
  "grace-started",
  "grace-half",
  "available",
  "owner-changed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Telegram chat id once the user has linked the bot; null otherwise. */
  telegramChatId: text("telegram_chat_id").unique(),
  /** False once Telegram reports the user blocked the bot — channel is dead. */
  telegramActive: boolean("telegram_active").notNull().default(true),
  email: text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  /** False after a hard bounce/unsubscribe — channel is dead. */
  emailActive: boolean("email_active").notNull().default(true),
  /** Short-lived code mailed out to prove email ownership (bot: /verify <code>). */
  emailVerifyCode: text("email_verify_code"),
  emailVerifyExpiresAt: timestamp("email_verify_expires_at", {
    withTimezone: true,
  }),
  /** Capability token for the one-click unsubscribe link in every email. */
  unsubscribeToken: uuid("unsubscribe_token")
    .notNull()
    .defaultRandom()
    .unique(),
});

/** Addresses monitored defensively: every name they own is auto-tracked. */
export const trackedAddresses = pgTable(
  "tracked_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stacksAddress: text("stacks_address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tracked_addresses_user_address").on(
      table.userId,
      table.stacksAddress,
    ),
  ],
);

/** Individual names a user cares about, in 'own' or 'want' mode. */
export const trackedNames = pgTable(
  "tracked_names",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Fully qualified name, lowercased, e.g. "muneeb.btc". */
    fqn: text("fqn").notNull(),
    mode: trackModeEnum("mode").notNull(),
    source: trackSourceEnum("source").notNull().default("manual"),
    /**
     * Deactivated (not deleted) when e.g. the name is transferred away from
     * the user — keeps history while stopping further expiry alerts.
     */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tracked_names_user_fqn").on(table.userId, table.fqn),
  ],
);

/** Latest observed on-chain state per name — one row per FQN, shared by all trackers. */
export const nameState = pgTable("name_state", {
  fqn: text("fqn").primaryKey(),
  name: text("name").notNull(),
  namespace: text("namespace").notNull(),
  owner: text("owner"),
  renewalHeight: bigint("renewal_height", { mode: "number" }),
  lifetime: bigint("lifetime", { mode: "number" }).notNull(),
  status: nameStatusEnum("status").notNull(),
  isManaged: boolean("is_managed").notNull().default(false),
  currentBurnBlock: bigint("current_burn_block", { mode: "number" }).notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Alert ledger + outbound queue. The unique index enforces the core promise:
 * each tier fires at most once per (user, name). `suppressed` rows are tiers
 * that matured already-obsolete (e.g. the 30d tier when a name is first
 * tracked with 2 days left) — recorded for idempotency, never delivered.
 */
export const alertsSent = pgTable(
  "alerts_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fqn: text("fqn").notNull(),
    alertType: alertTypeEnum("alert_type").notNull(),
    suppressed: boolean("suppressed").notNull().default(false),
    /** Snapshot for message rendering: status, heights, estimate at enqueue time. */
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set by the notifier once the message is actually out the door. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("alerts_sent_user_fqn_type").on(
      table.userId,
      table.fqn,
      table.alertType,
    ),
  ],
);
