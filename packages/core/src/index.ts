/**
 * @yagura/core — shared BNS logic for the Yagura watchtower.
 *
 * Layering:
 *   constants  — verified BNS V2 protocol facts (contract id, grace period)
 *   types      — domain model shared across worker/web
 *   status     — pure lifecycle derivation from chain numbers
 *   block-time — burn-height ↔ approximate wall-clock conversion
 *   alerts     — pure alert-tier scheduling rules
 *   http       — resilient fetch shared by the API clients
 *   bns-api    — BNS V2 indexer API client (primary read path)
 *   hiro       — Hiro Stacks API client (burn height, prices, chain truth)
 *   bns-client — the facade everything else consumes
 */

export * from "./constants.js";
export * from "./types.js";
export * from "./status.js";
export * from "./block-time.js";
export * from "./alerts.js";
export { HttpError } from "./http.js";
export { BnsApiClient, type BnsApiName } from "./bns-api.js";
export { HiroClient } from "./hiro.js";
export { YaguraBnsClient, splitFqn } from "./bns-client.js";
