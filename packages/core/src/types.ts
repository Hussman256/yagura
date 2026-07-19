/**
 * Shared domain types for Yagura.
 *
 * A note on the lifecycle: BNS V2 has no "expired but frozen" state. A name
 * runs `active` until its renewal height, sits in `grace` for 5,000 burn
 * blocks (only the owner may renew), and the moment grace ends it is
 * immediately acquirable by anyone via `name-renewal` — which is what we call
 * `available`. Namespaces with `lifetime = 0` (e.g. .stx, .app, and all
 * manager-controlled namespaces) never expire at all.
 */

/** Lifecycle status of a BNS name, derived from on-chain numbers — never guessed. */
export type NameStatus =
  /** Before renewal height; the owner is safe. */
  | "active"
  /** Past renewal height, within the 5,000-block grace period; only the owner can renew. */
  | "grace"
  /** Past grace (or never registered in a launched namespace): acquirable by anyone. */
  | "available"
  /** Namespace lifetime is 0 — the name can never expire. */
  | "nonexpiring"
  /** No record of this name on-chain; registrable through the normal flow. */
  | "unregistered"
  /**
   * Data was fetched fine but is ambiguous (e.g. renewal height 0 in an
   * expiring namespace with no import record). We NEVER alert on `unknown` —
   * availability pings must be high-precision.
   */
  | "unknown";

/** Properties of a BNS namespace, read from `get-namespace-properties`. */
export interface NamespaceProps {
  /** Namespace string without the dot, e.g. "btc". */
  namespace: string;
  /**
   * Name lifetime in burn blocks; 0 means names in this namespace never
   * expire. Verified live: btc=262800 (~5y), id=52595 (~1y), stx=0, app=0.
   */
  lifetime: number;
  /** Burn height the namespace launched at (0 for namespaces migrated from V1). */
  launchedAt: number | null;
  /** Manager contract, if any. Managed namespaces handle renewals themselves. */
  manager: string | null;
}

/** Everything Yagura knows about one name after a poll. */
export interface NameState {
  /** Fully qualified name, e.g. "muneeb.btc". */
  fqn: string;
  name: string;
  namespace: string;
  /** Current owner principal, or null if unregistered. */
  owner: string | null;
  /**
   * Burn height at which the name needs renewal, or null when not applicable
   * (nonexpiring / unregistered / unknown).
   */
  renewalHeight: number | null;
  /** Namespace lifetime in burn blocks (0 = never expires). */
  lifetime: number;
  status: NameStatus;
  /** Burn height observed when this state was fetched. */
  currentBurnBlock: number;
  /** True when the namespace has a manager contract. */
  isManaged: boolean;
}

/** A single name owned by an address (slim shape for list views). */
export interface OwnedName {
  fqn: string;
  name: string;
  namespace: string;
  renewalHeight: number | null;
}

/** Why a user is tracking a name. */
export type TrackMode =
  /** Defensive: alert before MY name expires. */
  | "own"
  /** Offensive: alert me when this name becomes acquirable. */
  | "want";
