import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Point workspace imports at core's TypeScript source so tests never run
    // against a stale dist build. Order matters: the subpath alias must come
    // before the package root.
    alias: [
      {
        find: "@yagura/core/db",
        replacement: fileURLToPath(
          new URL("../../packages/core/src/db/index.ts", import.meta.url),
        ),
      },
      {
        find: "@yagura/core",
        replacement: fileURLToPath(
          new URL("../../packages/core/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    // PGlite startup (WASM compile on first boot) makes these
    // integration-ish tests slower than pure units.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
