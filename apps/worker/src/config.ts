/**
 * Worker configuration, read once at boot from YAGURA_* environment
 * variables. Defaults are chosen so `pnpm dev` works with zero setup:
 * an embedded PGlite database in ./data, the public API endpoints, no
 * Telegram (until a token is set), and console-logged email.
 */

export interface WorkerConfig {
  databaseUrl: string;
  pollIntervalMs: number;
  hiroApiBase: string | undefined;
  hiroApiKey: string | undefined;
  bnsApiBase: string | undefined;
  /** Telegram bot token; when unset, the bot and Telegram delivery are off. */
  telegramBotToken: string | undefined;
  /** Email backend: 'resend' for real delivery, 'console' logs to stdout. */
  emailProvider: "resend" | "console";
  resendApiKey: string | undefined;
  /** From header, e.g. `Yagura <alerts@yagura.example>`. */
  emailFrom: string;
  /** Public base URL of the web app, used for action links in alerts. */
  webBaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const intervalMinutes = Number(env["YAGURA_POLL_INTERVAL_MINUTES"] ?? 10);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error("YAGURA_POLL_INTERVAL_MINUTES must be a positive number");
  }
  const emailProvider = env["YAGURA_EMAIL_PROVIDER"] || "console";
  if (emailProvider !== "resend" && emailProvider !== "console") {
    throw new Error(
      `Unknown YAGURA_EMAIL_PROVIDER "${emailProvider}" (expected resend|console)`,
    );
  }
  if (emailProvider === "resend" && !env["YAGURA_RESEND_API_KEY"]) {
    throw new Error("YAGURA_RESEND_API_KEY is required when the email provider is resend");
  }
  return {
    databaseUrl: env["YAGURA_DATABASE_URL"] || "pglite://./data/yagura-dev",
    pollIntervalMs: intervalMinutes * 60 * 1000,
    hiroApiBase: env["YAGURA_HIRO_API_BASE"] || undefined,
    hiroApiKey: env["YAGURA_HIRO_API_KEY"] || undefined,
    bnsApiBase: env["YAGURA_BNSV2_API_BASE"] || undefined,
    telegramBotToken: env["YAGURA_TELEGRAM_BOT_TOKEN"] || undefined,
    emailProvider,
    resendApiKey: env["YAGURA_RESEND_API_KEY"] || undefined,
    emailFrom: env["YAGURA_EMAIL_FROM"] || "Yagura <alerts@localhost>",
    webBaseUrl: (env["YAGURA_WEB_BASE_URL"] || "http://localhost:3000").replace(/\/$/, ""),
  };
}
