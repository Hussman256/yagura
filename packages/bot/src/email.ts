/**
 * Pluggable email delivery. Callers depend only on the EmailProvider
 * interface; concrete backends are chosen from config. Adding a provider
 * (Postmark, SES, …) means implementing one function — nothing else changes.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

/**
 * Delivery outcome, used to drive channel health:
 *  - sent       delivered to the provider
 *  - hard-fail  the address itself was rejected → mark the channel dead
 *  - soft-fail  transient (rate limit, 5xx) → leave queued, retry next cycle
 */
export type EmailResult = "sent" | "hard-fail" | "soft-fail";

export interface EmailProvider {
  send(email: OutboundEmail): Promise<EmailResult>;
}

/** Dev/default backend: prints the mail to stdout, always "delivers". */
export class ConsoleEmailProvider implements EmailProvider {
  async send(email: OutboundEmail): Promise<EmailResult> {
    console.log(
      `[email:console] to=${email.to} subject="${email.subject}"\n${email.text}`,
    );
    return "sent";
  }
}

/** Resend (resend.com) backend — free tier friendly, plain HTTP, no SDK. */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: OutboundEmail): Promise<EmailResult> {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          ...(email.headers ? { headers: email.headers } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return "soft-fail"; // network trouble — retry later
    }
    if (response.ok) return "sent";
    // 4xx other than rate limiting means this request can never succeed
    // (invalid address, suppressed recipient) — treat the channel as dead.
    if (response.status === 429 || response.status >= 500) return "soft-fail";
    return "hard-fail";
  }
}

/** The subset of app config buildEmailProvider needs — kept minimal so both
 * the worker's poller and the web app's webhook route can build one from
 * their own env-derived config without depending on each other's types. */
export interface EmailConfig {
  emailProvider: "resend" | "console";
  resendApiKey?: string | undefined;
  emailFrom: string;
}

/** Instantiate the configured backend. */
export function buildEmailProvider(config: EmailConfig): EmailProvider {
  if (config.emailProvider === "resend") {
    // Callers are expected to validate the key exists before choosing resend.
    if (!config.resendApiKey) {
      throw new Error("resendApiKey is required when emailProvider is 'resend'");
    }
    return new ResendEmailProvider(config.resendApiKey, config.emailFrom);
  }
  return new ConsoleEmailProvider();
}
