import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root, so output tracing doesn't guess from stray lockfiles.
  outputFileTracingRoot: join(__dirname, "..", ".."),
  // Keep the DB layer as Node externals: drivers are runtime-selected
  // (pg for postgres://, PGlite/WASM for pglite://) and @yagura/core locates
  // its bundled SQL migrations relative to its own file on disk — none of
  // that survives webpack bundling. Client components only ever import
  // core's pure functions, which bundle fine.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "drizzle-orm",
    "@yagura/core",
    "@yagura/bot",
    "grammy",
  ],
};

export default nextConfig;
