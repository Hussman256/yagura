import type { YaguraDb } from "@yagura/core/db";
import { Bot, GrammyError, InlineKeyboard } from "grammy";

import {
  cmdAddress,
  cmdEmail,
  cmdList,
  cmdStatus,
  cmdTrack,
  cmdUntrack,
  cmdVerify,
  ensureUser,
  START_TEXT,
  trackAs,
} from "./commands.js";
import type { EmailProvider } from "./email.js";
import type { TelegramSender } from "./notifier.js";
import type { BnsReader } from "./poller.js";

/**
 * grammY wiring: maps Telegram updates onto the plain handlers in
 * commands.ts. All state lives in the database except one small in-memory
 * map for the own-vs-want question (Telegram callback data is capped at 64
 * bytes — too small to carry long BNS names, so we key the pending name by
 * chat instead).
 */

export interface BotDeps {
  db: YaguraDb;
  bns: BnsReader;
  email: EmailProvider;
}

export function createBot(token: string, deps: BotDeps): Bot {
  const { db, bns, email } = deps;
  const bot = new Bot(token);
  /** chatId → fqn awaiting an own/want answer. */
  const pendingTrack = new Map<string, string>();

  const arg = (text: string | undefined): string =>
    (text ?? "").split(/\s+/).slice(1).join(" ").trim();

  bot.command("start", async (ctx) => {
    await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(START_TEXT);
  });

  bot.command("address", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(await cmdAddress(db, user, arg(ctx.message?.text)));
  });

  bot.command("track", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    const outcome = await cmdTrack(db, bns, user, arg(ctx.message?.text));
    if (outcome.kind === "ask") {
      pendingTrack.set(String(ctx.chat.id), outcome.fqn);
      await ctx.reply(outcome.reply, {
        reply_markup: new InlineKeyboard()
          .text("I own it 🛡", "track:own")
          .text("I want it 👁", "track:want"),
      });
    } else {
      await ctx.reply(outcome.reply);
    }
  });

  bot.callbackQuery(["track:own", "track:want"], async (ctx) => {
    const chatId = String(ctx.chat?.id ?? "");
    const fqn = pendingTrack.get(chatId);
    await ctx.answerCallbackQuery();
    if (!fqn) {
      await ctx.reply("That choice expired — /track the name again.");
      return;
    }
    pendingTrack.delete(chatId);
    const user = await ensureUser(db, chatId);
    const mode = ctx.callbackQuery.data === "track:own" ? "own" : "want";
    await ctx.reply(await trackAs(db, user, fqn, mode));
  });

  bot.command("watch", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    const fqn = arg(ctx.message?.text).toLowerCase();
    if (!fqn.includes(".")) {
      await ctx.reply("Usage: /watch name.namespace");
      return;
    }
    await ctx.reply(await trackAs(db, user, fqn, "want"));
  });

  bot.command("untrack", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(await cmdUntrack(db, user, arg(ctx.message?.text)));
  });

  bot.command("list", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(await cmdList(db, user));
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(await cmdStatus(bns, arg(ctx.message?.text)));
  });

  bot.command("email", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(await cmdEmail(db, email, user, arg(ctx.message?.text)));
  });

  bot.command("verify", async (ctx) => {
    const user = await ensureUser(db, String(ctx.chat.id));
    await ctx.reply(await cmdVerify(db, user, arg(ctx.message?.text)));
  });

  bot.catch((error) => {
    console.error(`[bot] ${String(error.error)}`);
  });

  return bot;
}

/** Outbound alert delivery through the same bot, with blocked-detection. */
export function telegramSenderFromBot(bot: Bot): TelegramSender {
  return {
    async send(chatId, text) {
      try {
        await bot.api.sendMessage(chatId, text, {
          link_preview_options: { is_disabled: true },
        });
        return "sent";
      } catch (error) {
        if (error instanceof GrammyError && error.error_code === 403) {
          return "blocked"; // user blocked the bot — channel is dead
        }
        return "soft-fail";
      }
    },
  };
}
