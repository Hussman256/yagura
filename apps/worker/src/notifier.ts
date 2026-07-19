import type { AlertTier } from "@yagura/core";
import { alertsSent, users, type YaguraDb } from "@yagura/core/db";
import { and, eq, isNull } from "drizzle-orm";

import type { EmailProvider } from "./email.js";
import { emailFooter, renderAlert, type AlertPayload } from "./messages.js";

/**
 * The notifier drains the outbound queue: every `alerts_sent` row with
 * `delivered_at` null and `suppressed` false, joined to its user, rendered
 * once and pushed through every live channel the user has.
 *
 * Channel-health policy (the "dead channel" rules from the spec):
 *  - Telegram says the user blocked the bot → telegram_active = false, stop.
 *  - Email hard-fails (address rejected)    → email_active = false, stop.
 *  - Transient failures leave the row queued; the next cycle retries.
 *  - A row is marked delivered as soon as ANY channel accepted it.
 *  - A user with no live channel at all gets the row marked delivered
 *    ("dropped") — alerts are time-sensitive; delivering a stale countdown
 *    after the user finally links a channel would be worse than silence.
 */

export type TelegramResult = "sent" | "blocked" | "soft-fail";

/** Thin sending interface so tests don't need a live bot. */
export interface TelegramSender {
  send(chatId: string, text: string): Promise<TelegramResult>;
}

export interface NotifierDeps {
  email: EmailProvider;
  /** Absent when no bot token is configured — Telegram delivery disabled. */
  telegram?: TelegramSender | undefined;
  webBaseUrl: string;
  log?: (message: string) => void;
}

export interface NotifyStats {
  delivered: number;
  dropped: number;
  retained: number;
  deadTelegramChannels: number;
  deadEmailChannels: number;
}

export async function drainAlerts(
  db: YaguraDb,
  deps: NotifierDeps,
): Promise<NotifyStats> {
  const { email, telegram, webBaseUrl, log = () => {} } = deps;
  const stats: NotifyStats = {
    delivered: 0,
    dropped: 0,
    retained: 0,
    deadTelegramChannels: 0,
    deadEmailChannels: 0,
  };

  const queue = await db
    .select({ alert: alertsSent, user: users })
    .from(alertsSent)
    .innerJoin(users, eq(alertsSent.userId, users.id))
    .where(and(isNull(alertsSent.deliveredAt), eq(alertsSent.suppressed, false)))
    .orderBy(alertsSent.createdAt);

  for (const { alert, user } of queue) {
    const rendered = renderAlert(
      alert.alertType as AlertTier,
      alert.payload as AlertPayload,
      webBaseUrl,
    );

    let anySent = false;
    let anySoftFail = false;

    // ── Telegram ──────────────────────────────────────────────────────────
    if (telegram && user.telegramActive && user.telegramChatId) {
      const result = await telegram.send(user.telegramChatId, rendered.text);
      if (result === "sent") anySent = true;
      else if (result === "blocked") {
        stats.deadTelegramChannels++;
        await db
          .update(users)
          .set({ telegramActive: false })
          .where(eq(users.id, user.id));
        log(`telegram channel dead for user ${user.id} (bot blocked)`);
      } else anySoftFail = true;
    }

    // ── Email (verified addresses only) ───────────────────────────────────
    if (user.emailActive && user.email && user.emailVerified) {
      const result = await email.send({
        to: user.email,
        subject: rendered.subject,
        text: rendered.text + emailFooter(webBaseUrl, user.unsubscribeToken),
        headers: {
          "List-Unsubscribe": `<${webBaseUrl}/unsubscribe?token=${user.unsubscribeToken}>`,
        },
      });
      if (result === "sent") anySent = true;
      else if (result === "hard-fail") {
        stats.deadEmailChannels++;
        await db
          .update(users)
          .set({ emailActive: false })
          .where(eq(users.id, user.id));
        log(`email channel dead for user ${user.id} (${user.email} rejected)`);
      } else anySoftFail = true;
    }

    if (anySent) {
      stats.delivered++;
      await db
        .update(alertsSent)
        .set({ deliveredAt: new Date() })
        .where(eq(alertsSent.id, alert.id));
    } else if (anySoftFail) {
      stats.retained++; // transient trouble — retry next cycle
    } else {
      stats.dropped++; // no live channel exists for this user
      await db
        .update(alertsSent)
        .set({ deliveredAt: new Date() })
        .where(eq(alertsSent.id, alert.id));
      log(`alert ${alert.alertType} for ${alert.fqn} dropped (user ${user.id} has no live channel)`);
    }
  }

  return stats;
}
