import { createDb, type YaguraDbHandle } from "@yagura/core/db";

/**
 * Lazy database singleton for server components and route handlers.
 * The web app runs fine with NO database (public name pages and renewal are
 * pure chain reads) — metrics and unsubscribe simply degrade when
 * YAGURA_DATABASE_URL is unset.
 */

let handlePromise: Promise<YaguraDbHandle> | null = null;
let warned = false;

export function getDb(): Promise<YaguraDbHandle> | null {
  const url = process.env["YAGURA_DATABASE_URL"];
  if (!url) return null;
  // PGlite (the embedded dev database) cannot run inside Next's bundled
  // server runtime — it needs plain Node. The web app therefore requires a
  // real postgres:// URL and otherwise runs in its no-database mode.
  if (url.startsWith("pglite://")) {
    if (!warned) {
      warned = true;
      console.warn(
        "[yagura-web] pglite:// databases are worker-only; running without a database",
      );
    }
    return null;
  }
  // The worker owns migrations; the web app only reads/updates rows.
  handlePromise ??= createDb(url);
  return handlePromise;
}
