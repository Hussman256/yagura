import { createBot, createWebhookHandler } from "@yagura/bot";

import { getBns } from "@/lib/bns";
import { getDb } from "@/lib/db";
import { getEmailProvider } from "@/lib/email";

/**
 * Telegram webhook endpoint — replaces the worker's long-polling bot.
 * Telegram POSTs each update here; grammY's webhookCallback verifies the
 * `X-Telegram-Bot-Api-Secret-Token` header against YAGURA_TELEGRAM_WEBHOOK_SECRET
 * before anything touches the database, so requests that don't come from
 * Telegram are rejected up front.
 *
 * One-time setup after deploying: register this URL with Telegram —
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEB_BASE_URL>/api/telegram/webhook&secret_token=<SECRET>"
 * (see README's deploy section). Needs Node (grammY + the pg driver), not Edge.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let handlerPromise: Promise<(request: Request) => Promise<Response>> | null = null;

async function buildHandler(): Promise<(request: Request) => Promise<Response>> {
  const token = process.env["YAGURA_TELEGRAM_BOT_TOKEN"];
  const secret = process.env["YAGURA_TELEGRAM_WEBHOOK_SECRET"];
  const dbPromise = getDb();
  if (!token || !secret || !dbPromise) {
    throw new Error(
      "Telegram webhook misconfigured: YAGURA_TELEGRAM_BOT_TOKEN, " +
        "YAGURA_TELEGRAM_WEBHOOK_SECRET, and a real YAGURA_DATABASE_URL are all required",
    );
  }
  const { db } = await dbPromise;
  const bot = createBot(token, { db, bns: getBns(), email: getEmailProvider() });
  return createWebhookHandler(bot, secret);
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Memoized across warm invocations of the same serverless instance;
    // a misconfiguration fails the same way on every request rather than
    // retrying construction, which would just fail again.
    handlerPromise ??= buildHandler();
    const handler = await handlerPromise;
    return await handler(request);
  } catch (error) {
    console.error("[telegram-webhook]", error);
    return new Response("internal error", { status: 500 });
  }
}
