import { NAME_GRACE_PERIOD_BLOCKS } from "./constants.js";
import type { NameStatus } from "./types.js";

/** Inputs needed to classify a registered name. All heights are burn blocks. */
export interface StatusInputs {
  /** `renewal-height` from the name record (0 is a special "see namespace" value). */
  renewalHeight: number;
  /** Namespace lifetime; 0 means names never expire. */
  lifetime: number;
  /** Burn height the namespace launched at, if known (0 for V1-migrated ones). */
  launchedAt: number | null;
  /** Whether an `imported-at` height is set on the name record. */
  imported: boolean;
  /** Current Bitcoin burn block height. */
  currentBurnBlock: number;
}

/**
 * Derive a name's lifecycle status from raw chain numbers.
 *
 * Mirrors the contract's own logic (`get-renewal-height` + the grace check in
 * `name-renewal`):
 *   - lifetime 0            → nonexpiring (includes all managed namespaces)
 *   - renewal-height 0      → imported name; effective height is
 *                             launched-at + lifetime (only if we can prove it,
 *                             otherwise `unknown` — we refuse to guess)
 *   - now <  H              → active
 *   - H ≤ now < H + 5000    → grace (owner-only renewal window)
 *   - now ≥ H + 5000        → available (anyone can take it via name-renewal)
 */
export function deriveNameStatus(inputs: StatusInputs): NameStatus {
  const { renewalHeight, lifetime, launchedAt, imported, currentBurnBlock } =
    inputs;

  if (lifetime === 0) return "nonexpiring";

  let effectiveRenewalHeight = renewalHeight;
  if (renewalHeight === 0) {
    // Contract semantics: renewal-height 0 in an expiring namespace means the
    // name was imported at namespace launch, expiring at launched-at + lifetime.
    // Without a confirmed import record we cannot distinguish this from bad
    // data, and a wrong "it's free!" alert is the one mistake Yagura must
    // never make — so anything unprovable is `unknown`.
    if (!imported || launchedAt === null) return "unknown";
    effectiveRenewalHeight = launchedAt + lifetime;
  }

  if (currentBurnBlock < effectiveRenewalHeight) return "active";
  if (currentBurnBlock < effectiveRenewalHeight + NAME_GRACE_PERIOD_BLOCKS) {
    return "grace";
  }
  return "available";
}

/**
 * The effective renewal height a UI should display, or null when the name
 * cannot expire / the height cannot be proven. Same resolution rules as
 * {@link deriveNameStatus}.
 */
export function effectiveRenewalHeight(
  inputs: Omit<StatusInputs, "currentBurnBlock">,
): number | null {
  const { renewalHeight, lifetime, launchedAt, imported } = inputs;
  if (lifetime === 0) return null;
  if (renewalHeight > 0) return renewalHeight;
  if (imported && launchedAt !== null) return launchedAt + lifetime;
  return null;
}
