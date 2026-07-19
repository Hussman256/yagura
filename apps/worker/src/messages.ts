import { formatApproxBlocks, type AlertTier } from "@yagura/core";

/**
 * Alert message rendering — pure functions from an alert row's payload
 * snapshot to channel-ready copy. Every message answers three questions:
 * which name, what happened (or will happen) and roughly when, and what
 * one action to take — with the link that does it.
 *
 * Renewal links go to our /renew/<fqn> deep-link page (opens the wallet with
 * the pre-filled name-renewal call); registration links go to BNS One, whose
 * `/register?search=<name>` route is their supported entry point.
 */

/** The snapshot the poller stores in alerts_sent.payload. */
export interface AlertPayload {
  fqn: string;
  status: string;
  renewalHeight: number | null;
  currentBurnBlock: number;
  expiryEstimateIso: string | null;
}

export interface RenderedAlert {
  /** Email subject; also a fine one-line summary. */
  subject: string;
  /** Plain text body (email text part, and Telegram message as-is). */
  text: string;
}

const shortDate = (iso: string | null): string =>
  iso ? iso.slice(0, 10) : "unknown date";

export function renderAlert(
  tier: AlertTier,
  payload: AlertPayload,
  webBaseUrl: string,
): RenderedAlert {
  const { fqn } = payload;
  const renewUrl = `${webBaseUrl}/renew/${encodeURIComponent(fqn)}`;
  const registerUrl = `https://bns.one/register?search=${encodeURIComponent(
    fqn.split(".")[0] ?? fqn,
  )}`;
  const blocksLeft =
    payload.renewalHeight !== null
      ? payload.renewalHeight - payload.currentBurnBlock
      : null;
  const inAbout =
    blocksLeft !== null ? formatApproxBlocks(blocksLeft) : "soon";
  const estDate = shortDate(payload.expiryEstimateIso);

  switch (tier) {
    case "expiry-30d":
      return {
        subject: `${fqn} expires in ${inAbout}`,
        text:
          `Heads up from the watchtower: ${fqn} expires in ${inAbout} (around ${estDate}).\n` +
          `Renew in one tap: ${renewUrl}`,
      };
    case "expiry-7d":
      return {
        subject: `${fqn} expires in ${inAbout}`,
        text:
          `${fqn} expires in ${inAbout} (around ${estDate}). Don't let it lapse.\n` +
          `Renew in one tap: ${renewUrl}`,
      };
    case "expiry-1d":
      return {
        subject: `Last call: ${fqn} expires in ${inAbout}`,
        text:
          `Last call — ${fqn} expires in ${inAbout} (around ${estDate}).\n` +
          `Renew now: ${renewUrl}`,
      };
    case "grace-started":
      return {
        subject: `${fqn} has expired — grace period running`,
        text:
          `${fqn} has passed its renewal height. You are in the ~34-day grace period: ` +
          `only you can renew until it ends, then ANYONE can claim the name.\n` +
          `Renew now: ${renewUrl}`,
      };
    case "grace-half":
      return {
        subject: `${fqn}: half the grace period is gone`,
        text:
          `About half of ${fqn}'s grace period is gone. When it ends, the name is up for grabs.\n` +
          `Renew now: ${renewUrl}`,
      };
    case "available":
      return {
        subject: `${fqn} is available now`,
        text:
          `The name you watch is claimable: ${fqn} is available right now — ` +
          `first come, first served.\n` +
          `Register it: ${registerUrl}`,
      };
    case "owner-changed":
      return {
        subject: `You no longer own ${fqn}`,
        text:
          `${fqn} is no longer owned by your tracked address — it was transferred. ` +
          `Expiry alerts for it are stopped.\n` +
          `Details: ${webBaseUrl}/name/${encodeURIComponent(fqn)}`,
      };
  }
}

/** Body of the email-ownership verification mail (code entered via the bot). */
export function renderVerificationEmail(code: string): RenderedAlert {
  return {
    subject: `Yagura verification code: ${code}`,
    text:
      `Your Yagura email verification code is: ${code}\n\n` +
      `Send /verify ${code} to the Yagura Telegram bot to confirm this address.\n` +
      `The code expires in 30 minutes. If you didn't request this, ignore it.`,
  };
}

/** Footer appended to every outbound email — one-click opt-out, always. */
export function emailFooter(webBaseUrl: string, unsubscribeToken: string): string {
  return (
    `\n\n—\nYagura, the watchtower for your BNS names.\n` +
    `Unsubscribe: ${webBaseUrl}/unsubscribe?token=${unsubscribeToken}`
  );
}
