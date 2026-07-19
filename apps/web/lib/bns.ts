import { YaguraBnsClient } from "@yagura/core";

/** Shared server-side BNS client (namespace cache lives for the process). */
let client: YaguraBnsClient | null = null;

export function getBns(): YaguraBnsClient {
  client ??= new YaguraBnsClient({
    bnsApi: process.env["YAGURA_BNSV2_API_BASE"]
      ? { baseUrl: process.env["YAGURA_BNSV2_API_BASE"] }
      : {},
    hiro: {
      ...(process.env["YAGURA_HIRO_API_BASE"]
        ? { baseUrl: process.env["YAGURA_HIRO_API_BASE"] }
        : {}),
      ...(process.env["YAGURA_HIRO_API_KEY"]
        ? { apiKey: process.env["YAGURA_HIRO_API_KEY"] }
        : {}),
    },
  });
  return client;
}

/** Telegram bot deep-link, when a bot username is configured. */
export function telegramBotUrl(startPayload?: string): string | null {
  const username = process.env["YAGURA_TELEGRAM_BOT_USERNAME"];
  if (!username) return null;
  const base = `https://t.me/${username}`;
  return startPayload ? `${base}?start=${startPayload}` : base;
}

/**
 * Deep-link that makes the bot watch a name on /start. Telegram payloads
 * only allow [A-Za-z0-9_-] and max 64 chars, so the fqn (which contains a
 * dot) travels base64url; the rare name too long to encode falls back to a
 * plain bot link.
 */
export function telegramWatchUrl(fqn: string): string | null {
  const payload = `w_${Buffer.from(fqn, "utf8").toString("base64url")}`;
  return telegramBotUrl(payload.length <= 64 ? payload : undefined);
}
