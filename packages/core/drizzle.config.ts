import { defineConfig } from "drizzle-kit";

/** drizzle-kit config: `pnpm drizzle-kit generate` writes SQL migrations to ./drizzle. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
