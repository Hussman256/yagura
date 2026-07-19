/**
 * Worker configuration, read once at boot from YAGURA_* environment
 * variables. Defaults are chosen so `pnpm dev` works with zero setup:
 * an embedded PGlite database in ./data and the public API endpoints.
 */

export interface WorkerConfig {
  databaseUrl: string;
  pollIntervalMs: number;
  hiroApiBase: string | undefined;
  hiroApiKey: string | undefined;
  bnsApiBase: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const intervalMinutes = Number(env["YAGURA_POLL_INTERVAL_MINUTES"] ?? 10);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error("YAGURA_POLL_INTERVAL_MINUTES must be a positive number");
  }
  return {
    databaseUrl: env["YAGURA_DATABASE_URL"] || "pglite://./data/yagura-dev",
    pollIntervalMs: intervalMinutes * 60 * 1000,
    hiroApiBase: env["YAGURA_HIRO_API_BASE"] || undefined,
    hiroApiKey: env["YAGURA_HIRO_API_KEY"] || undefined,
    bnsApiBase: env["YAGURA_BNSV2_API_BASE"] || undefined,
  };
}
