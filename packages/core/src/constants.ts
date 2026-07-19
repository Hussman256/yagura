/**
 * Protocol constants for BNS V2 on Stacks mainnet.
 *
 * Every value here was verified on 2026-07-19 against the deployed contract
 * source (`/v2/contracts/source/...BNS-V2` via the Hiro API) rather than
 * copied from secondary docs. If you fork this for another network, re-verify.
 */

/** Deployer of the live BNS V2 contract (mainnet, deployed September 2024). */
export const BNS_V2_CONTRACT_ADDRESS =
  "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF";

/** Contract name of the live BNS V2 contract. */
export const BNS_V2_CONTRACT_NAME = "BNS-V2";

/** Fully qualified contract id, convenient for API calls and post-conditions. */
export const BNS_V2_CONTRACT_ID =
  `${BNS_V2_CONTRACT_ADDRESS}.${BNS_V2_CONTRACT_NAME}` as const;

/** SIP-09 NFT asset name — every BNS V2 name is an NFT of this class. */
export const BNS_V2_ASSET_NAME = "BNS-V2";

/**
 * Grace period after a name's renewal height, in Bitcoin (burn) blocks.
 * From the contract: `(define-constant NAME-GRACE-PERIOD-DURATION u5000)`
 * (~34.7 days at 10 min/block). During grace only the owner can renew;
 * after grace, ANYONE can call `name-renewal` and take the name over.
 */
export const NAME_GRACE_PERIOD_BLOCKS = 5000;

/**
 * The public renewal entrypoint: `(name-renewal (namespace (buff 20)) (name (buff 48)))`.
 * Note it takes NO stx-to-burn argument — the contract computes the price
 * itself (`get-name-price`) and burns it from the caller, so wallets need a
 * burn post-condition sized via that read-only function.
 */
export const BNS_V2_RENEWAL_FUNCTION = "name-renewal";

/**
 * Average Bitcoin block time we assume when turning burn-block deltas into
 * wall-clock estimates. Displayed dates are always approximate and are
 * recomputed on every poll — never persisted as fixed timestamps.
 */
export const BURN_BLOCK_SECONDS = 600;

/** Burn blocks per day under the 10-minute assumption. */
export const BURN_BLOCKS_PER_DAY = 144;

/** Default public Hiro Stacks Blockchain API endpoint. */
export const DEFAULT_HIRO_API_BASE = "https://api.hiro.so";

/** Default BNS V2 indexer API (Strata Labs — backs the official bns-v2-sdk). */
export const DEFAULT_BNSV2_API_BASE = "https://api.bnsv2.com";
