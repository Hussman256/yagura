/**
 * @yagura/bot — Telegram bot commands, webhook handler, alert message
 * rendering, and pluggable email delivery.
 *
 * Two consumers:
 *   - apps/worker (GitHub Actions poller): uses email + notifier + a bot
 *     instance's `.api` (never started/webhooked) to deliver queued alerts.
 *   - apps/web (Vercel): uses createBot + createWebhookHandler to answer
 *     Telegram updates via an API route.
 */

export {
  cmdAddress,
  cmdEmail,
  cmdList,
  cmdStatus,
  cmdTrack,
  cmdUntrack,
  cmdVerify,
  clearExpiredPendingTracks,
  ensureUser,
  parseStartPayload,
  START_TEXT,
  takePendingTrack,
  trackAs,
  type StartPayload,
  type TrackOutcome,
} from "./commands.js";
export { createBot, createWebhookHandler, telegramSenderFromBot, type BotDeps } from "./bot.js";
export {
  emailFooter,
  renderAlert,
  renderVerificationEmail,
  type AlertPayload,
  type RenderedAlert,
} from "./messages.js";
export {
  buildEmailProvider,
  ConsoleEmailProvider,
  ResendEmailProvider,
  type EmailConfig,
  type EmailProvider,
  type EmailResult,
  type OutboundEmail,
} from "./email.js";
export { drainAlerts, type NotifierDeps, type NotifyStats, type TelegramResult, type TelegramSender } from "./notifier.js";
