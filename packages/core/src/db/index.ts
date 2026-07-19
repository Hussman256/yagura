/**
 * @yagura/core/db — Drizzle schema and database bootstrap, imported via the
 * "./db" subpath so consumers that never touch the database (e.g. pure BNS
 * lookups) don't pull in driver code.
 */
export * from "./schema.js";
export { createDb, type YaguraDb, type YaguraDbHandle } from "./client.js";
