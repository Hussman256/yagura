import type { Metadata } from "next";

import { users } from "@yagura/core/db";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Unsubscribe · Yagura" };
export const dynamic = "force-dynamic";

/**
 * One-click email opt-out — the link carried by every mail we send (and its
 * List-Unsubscribe header). GET with a capability token, as one-click
 * unsubscribe links must be; flips email_active off and nothing else.
 * Telegram alerts and tracking are untouched.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let outcome: "done" | "invalid" | "no-db" | "error" = "invalid";
  const handlePromise = getDb();
  if (!handlePromise) {
    outcome = "no-db";
  } else if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    try {
      const { db } = await handlePromise;
      const updated = await db
        .update(users)
        .set({ emailActive: false })
        .where(eq(users.unsubscribeToken, token))
        .returning({ id: users.id });
      if (updated.length > 0) outcome = "done";
    } catch {
      outcome = "error";
    }
  }

  const toneClass = outcome === "done" ? "text-moss" : outcome === "error" ? "text-shu" : "text-washi-dim";

  return (
    <div className="py-24">
      <p className="rise rise-1 font-mono text-[13px] tracking-[0.25em] text-washi-dim uppercase">
        email preferences
      </p>
      <h1 className="rise rise-2 mt-4 font-display text-3xl text-washi">
        {outcome === "done" ? "Unsubscribed." : "Hm."}
      </h1>
      <p className={`rise rise-3 mt-4 max-w-xl text-sm leading-relaxed ${toneClass}`}>
        {outcome === "done" &&
          "No more emails from Yagura. Telegram alerts (if linked) and your tracked names are unchanged — send /email to the bot any time to switch email back on."}
        {outcome === "invalid" &&
          "That unsubscribe link is invalid or was already used with a rotated token. If you keep receiving mail, reply to any Yagura email and a human will sort it."}
        {outcome === "no-db" &&
          "This deployment has no database attached, so there is nothing to unsubscribe from here."}
        {outcome === "error" &&
          "The database is unreachable right now — please try the link again in a few minutes."}
      </p>
    </div>
  );
}
