import {
  alertsSent,
  createDb,
  users,
  type YaguraDbHandle,
} from "@yagura/core/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EmailProvider, EmailResult, OutboundEmail } from "../src/email.js";
import { drainAlerts, type TelegramResult, type TelegramSender } from "../src/notifier.js";

/** Recording fakes with scriptable outcomes. */
class FakeEmail implements EmailProvider {
  sent: OutboundEmail[] = [];
  result: EmailResult = "sent";
  async send(email: OutboundEmail): Promise<EmailResult> {
    if (this.result === "sent") this.sent.push(email);
    return this.result;
  }
}
class FakeTelegram implements TelegramSender {
  sent: Array<{ chatId: string; text: string }> = [];
  result: TelegramResult = "sent";
  async send(chatId: string, text: string): Promise<TelegramResult> {
    if (this.result === "sent") this.sent.push({ chatId, text });
    return this.result;
  }
}

let handle: YaguraDbHandle;
let email: FakeEmail;
let telegram: FakeTelegram;

const WEB = "https://yagura.example";

beforeEach(async () => {
  handle = await createDb("pglite://memory");
  await handle.migrate();
  email = new FakeEmail();
  telegram = new FakeTelegram();
});

afterEach(async () => {
  await handle.close();
});

async function seedUser(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const [row] = await handle.db
    .insert(users)
    .values({
      telegramChatId: "12345",
      email: "watch@example.com",
      emailVerified: true,
      ...overrides,
    })
    .returning();
  return row!;
}

async function seedAlert(
  userId: string,
  overrides: Partial<typeof alertsSent.$inferInsert> = {},
): Promise<string> {
  const [row] = await handle.db
    .insert(alertsSent)
    .values({
      userId,
      fqn: "muneeb.btc",
      alertType: "expiry-7d",
      payload: {
        fqn: "muneeb.btc",
        status: "active",
        renewalHeight: 1_126_023,
        currentBurnBlock: 1_125_000,
        expiryEstimateIso: "2029-09-23T00:00:00.000Z",
      },
      ...overrides,
    })
    .returning();
  return row!.id;
}

describe("drainAlerts", () => {
  it("delivers through both channels and marks the row delivered", async () => {
    const user = await seedUser();
    const alertId = await seedAlert(user.id);

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.delivered).toBe(1);
    expect(telegram.sent).toHaveLength(1);
    expect(telegram.sent[0]!.text).toContain("muneeb.btc");
    expect(telegram.sent[0]!.text).toContain(`${WEB}/renew/muneeb.btc`);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.text).toContain("Unsubscribe:");
    expect(email.sent[0]!.headers?.["List-Unsubscribe"]).toContain("/unsubscribe?token=");

    const [row] = await handle.db
      .select()
      .from(alertsSent)
      .where(eq(alertsSent.id, alertId));
    expect(row!.deliveredAt).not.toBeNull();

    // Second drain: queue is empty, nothing re-sent.
    const again = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });
    expect(again.delivered).toBe(0);
    expect(telegram.sent).toHaveLength(1);
  });

  it("never emails unverified addresses", async () => {
    const user = await seedUser({ emailVerified: false });
    await seedAlert(user.id);

    await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(email.sent).toHaveLength(0);
    expect(telegram.sent).toHaveLength(1); // telegram still works
  });

  it("marks the telegram channel dead when the bot is blocked", async () => {
    const user = await seedUser({ email: null });
    await seedAlert(user.id);
    telegram.result = "blocked";

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.deadTelegramChannels).toBe(1);
    const [row] = await handle.db.select().from(users).where(eq(users.id, user.id));
    expect(row!.telegramActive).toBe(false);
  });

  it("marks the email channel dead on a hard failure", async () => {
    const user = await seedUser({ telegramChatId: null });
    await seedAlert(user.id);
    email.result = "hard-fail";

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.deadEmailChannels).toBe(1);
    const [row] = await handle.db.select().from(users).where(eq(users.id, user.id));
    expect(row!.emailActive).toBe(false);
  });

  it("keeps the row queued on transient failures", async () => {
    const user = await seedUser({ email: null });
    const alertId = await seedAlert(user.id);
    telegram.result = "soft-fail";

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.retained).toBe(1);
    const [row] = await handle.db
      .select()
      .from(alertsSent)
      .where(eq(alertsSent.id, alertId));
    expect(row!.deliveredAt).toBeNull(); // will retry next cycle
  });

  it("drops alerts for users with no live channel", async () => {
    const user = await seedUser({ telegramChatId: null, email: null });
    const alertId = await seedAlert(user.id);

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.dropped).toBe(1);
    const [row] = await handle.db
      .select()
      .from(alertsSent)
      .where(eq(alertsSent.id, alertId));
    expect(row!.deliveredAt).not.toBeNull(); // closed, not retried forever
  });

  it("skips suppressed rows entirely", async () => {
    const user = await seedUser();
    await seedAlert(user.id, { alertType: "expiry-30d", suppressed: true });

    const stats = await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(stats.delivered + stats.dropped + stats.retained).toBe(0);
    expect(telegram.sent).toHaveLength(0);
  });

  it("points 'available' alerts at the BNS One registration flow", async () => {
    const user = await seedUser();
    await seedAlert(user.id, {
      fqn: "prize.btc",
      alertType: "available",
      payload: {
        fqn: "prize.btc",
        status: "available",
        renewalHeight: null,
        currentBurnBlock: 958_000,
        expiryEstimateIso: null,
      },
    });

    await drainAlerts(handle.db, { email, telegram, webBaseUrl: WEB });

    expect(telegram.sent[0]!.text).toContain("https://bns.one/register?search=prize");
  });
});
