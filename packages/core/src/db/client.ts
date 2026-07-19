import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema.js";

/**
 * Database bootstrap. Two drivers, one schema, chosen by URL:
 *
 *   postgres://…       real Postgres via node-postgres — production
 *   pglite://memory    in-process Postgres, in-memory — unit tests
 *   pglite://<path>    in-process Postgres persisted to a directory — local dev
 *
 * PGlite is real Postgres compiled to WASM, so dev/tests exercise the exact
 * SQL that production runs — no SQLite dialect drift. Drivers are imported
 * lazily so consumers only pay for the one they use.
 */

/** The database handle type shared by worker and web regardless of driver. */
export type YaguraDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface YaguraDbHandle {
  db: YaguraDb;
  /** Apply all pending SQL migrations from packages/core/drizzle. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

/** Bundled migrations live at <core package root>/drizzle, two levels up from this file. */
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function createDb(databaseUrl: string): Promise<YaguraDbHandle> {
  if (databaseUrl.startsWith("pglite://")) {
    const target = databaseUrl.slice("pglite://".length);
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // PGlite expects its data directory to already exist.
    if (target !== "memory") mkdirSync(target, { recursive: true });
    const pglite = target === "memory" ? new PGlite() : new PGlite(target);
    const db = drizzle(pglite, { schema });
    return {
      db: db as unknown as YaguraDb,
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => pglite.close(),
    };
  }

  if (/^postgres(ql)?:\/\//.test(databaseUrl)) {
    const { default: pg } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const db = drizzle(pool, { schema });
    return {
      db: db as unknown as YaguraDb,
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => pool.end(),
    };
  }

  throw new Error(
    `Unsupported YAGURA_DATABASE_URL "${databaseUrl}" — expected postgres:// or pglite://`,
  );
}
