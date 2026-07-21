import { buildEmailProvider, type EmailProvider } from "@yagura/bot";

/**
 * Shared email provider for the web app — used only by the Telegram webhook
 * route's /email command (verification codes). Mirrors the worker's own
 * config-to-provider wiring in apps/worker/src/config.ts, kept separate
 * because a package can't depend on either app.
 */

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  provider ??= buildEmailProvider({
    emailProvider:
      process.env["YAGURA_EMAIL_PROVIDER"] === "resend" ? "resend" : "console",
    resendApiKey: process.env["YAGURA_RESEND_API_KEY"],
    emailFrom: process.env["YAGURA_EMAIL_FROM"] || "Yagura <alerts@localhost>",
  });
  return provider;
}
