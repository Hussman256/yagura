import type { Metadata } from "next";

import { telegramBotUrl } from "@/lib/bns";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard · Yagura" };

export default function DashboardPage() {
  // Strip any ?start= payload — the client appends its own per-wallet one.
  const base = telegramBotUrl();
  return (
    <div className="py-16">
      <p className="font-mono text-[13px] tracking-[0.25em] text-washi-dim uppercase">
        your names
      </p>
      <h1 className="mt-3 mb-10 font-display text-4xl text-washi">Dashboard</h1>
      <DashboardClient botUrl={base} />
    </div>
  );
}
