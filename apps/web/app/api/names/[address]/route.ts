import { NextResponse } from "next/server";

import { deriveNameStatus, type NameStatus } from "@yagura/core";

import { getBns } from "@/lib/bns";

/**
 * GET /api/names/:address — every name the address owns, with a derived
 * status. One listing call + one burn-height call + one cached namespace
 * lookup per distinct namespace; no per-name resolution, so large holders
 * stay fast. (Imported V1 names with renewal-height 0 show as `unknown`
 * here — the /name page does the full per-name resolution.)
 */

export interface DashboardName {
  fqn: string;
  namespace: string;
  renewalHeight: number | null;
  status: NameStatus;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!/^S[PM][0-9A-HJKMNP-TV-Z]{35,45}$/.test(address.toUpperCase())) {
    return NextResponse.json({ error: "invalid Stacks address" }, { status: 400 });
  }

  const bns = getBns();
  try {
    const [owned, currentBurnBlock] = await Promise.all([
      bns.listNamesOwnedBy(address.toUpperCase()),
      bns.hiro.getBurnBlockHeight(),
    ]);

    const names: DashboardName[] = [];
    for (const name of owned) {
      const nsProps = await bns.getNamespace(name.namespace); // 1h in-memory cache
      const lifetime = nsProps?.lifetime ?? 0;
      names.push({
        fqn: name.fqn,
        namespace: name.namespace,
        renewalHeight: name.renewalHeight,
        status: deriveNameStatus({
          renewalHeight: name.renewalHeight ?? 0,
          lifetime,
          launchedAt: nsProps?.launchedAt ?? null,
          imported: false,
          currentBurnBlock,
        }),
      });
    }
    return NextResponse.json({ currentBurnBlock, names });
  } catch {
    return NextResponse.json(
      { error: "chain data unavailable, try again shortly" },
      { status: 502 },
    );
  }
}
