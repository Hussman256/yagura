import { BnsApiClient, type BnsApiClientOptions } from "./bns-api.js";
import { HiroClient, type HiroClientOptions } from "./hiro.js";
import { deriveNameStatus, effectiveRenewalHeight } from "./status.js";
import type { NameState, NamespaceProps, OwnedName } from "./types.js";

/**
 * YaguraBnsClient — the one entry point the worker, web app, and CLI use to
 * ask questions about BNS names. Composes the BNS V2 indexer API (primary
 * read path) with the Hiro API (burn height, prices, on-chain truth) and the
 * pure status-derivation rules.
 *
 * Namespace properties are cached in-memory for an hour: lifetimes and
 * managers effectively never change, and the cache keeps a poll over many
 * names from hammering the API with identical lookups.
 */

const NAMESPACE_CACHE_TTL_MS = 60 * 60 * 1000;

export interface YaguraBnsClientOptions {
  bnsApi?: BnsApiClientOptions;
  hiro?: HiroClientOptions;
}

/**
 * The slice of {@link YaguraBnsClient}'s public API that consumers (the
 * poller, the bot's /track and /status commands) actually need — small
 * enough to fake in tests without a real client.
 */
export interface BnsReader {
  resolveName(fqn: string): Promise<NameState>;
  listNamesOwnedBy(address: string): Promise<OwnedName[]>;
}

/** Split "muneeb.btc" → { name: "muneeb", namespace: "btc" }. */
export function splitFqn(fqn: string): { name: string; namespace: string } {
  const trimmed = fqn.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    throw new Error(
      `"${fqn}" is not a fully qualified BNS name (expected name.namespace)`,
    );
  }
  return {
    name: trimmed.slice(0, lastDot),
    namespace: trimmed.slice(lastDot + 1),
  };
}

export class YaguraBnsClient {
  readonly bnsApi: BnsApiClient;
  readonly hiro: HiroClient;
  private readonly namespaceCache = new Map<
    string,
    { props: NamespaceProps | null; fetchedAt: number }
  >();

  constructor(options: YaguraBnsClientOptions = {}) {
    this.bnsApi = new BnsApiClient(options.bnsApi);
    this.hiro = new HiroClient(options.hiro);
  }

  /** Namespace properties with a 1-hour in-memory cache. */
  async getNamespace(namespace: string): Promise<NamespaceProps | null> {
    const cached = this.namespaceCache.get(namespace);
    if (cached && Date.now() - cached.fetchedAt < NAMESPACE_CACHE_TTL_MS) {
      return cached.props;
    }
    const props = await this.bnsApi.getNamespace(namespace);
    this.namespaceCache.set(namespace, { props, fetchedAt: Date.now() });
    return props;
  }

  /**
   * Resolve a fully qualified name to its full Yagura state: owner, effective
   * renewal height, and derived lifecycle status.
   *
   * Throws on network/API failure — callers must treat a failed poll as
   * "no new information", never as "the name is gone".
   */
  async resolveName(fqn: string): Promise<NameState> {
    const { name, namespace } = splitFqn(fqn);
    const [record, nsProps] = await Promise.all([
      this.bnsApi.getName(`${name}.${namespace}`),
      this.getNamespace(namespace),
    ]);

    // Name has never been registered. Only call it registrable when the
    // namespace itself provably exists and has launched.
    if (record === null) {
      const currentBurnBlock = await this.hiro.getBurnBlockHeight();
      return {
        fqn: `${name}.${namespace}`,
        name,
        namespace,
        owner: null,
        renewalHeight: null,
        lifetime: nsProps?.lifetime ?? 0,
        status: nsProps === null ? "unknown" : "unregistered",
        currentBurnBlock,
        isManaged: nsProps?.manager !== null && nsProps !== null,
      };
    }

    const lifetime = nsProps?.lifetime ?? (record.isManaged ? 0 : NaN);
    if (!Number.isFinite(lifetime)) {
      // We know the name exists but not its namespace rules; refuse to guess.
      return {
        fqn: record.fqn,
        name,
        namespace,
        owner: record.owner,
        renewalHeight: null,
        lifetime: 0,
        status: "unknown",
        currentBurnBlock: record.currentBurnBlock,
        isManaged: record.isManaged,
      };
    }

    const statusInputs = {
      renewalHeight: record.renewalHeight,
      lifetime,
      launchedAt: nsProps?.launchedAt ?? null,
      imported: record.importedAt !== null,
    };
    return {
      fqn: record.fqn,
      name,
      namespace,
      owner: record.owner,
      renewalHeight: effectiveRenewalHeight(statusInputs),
      lifetime,
      status: deriveNameStatus({
        ...statusInputs,
        currentBurnBlock: record.currentBurnBlock,
      }),
      currentBurnBlock: record.currentBurnBlock,
      isManaged: record.isManaged,
    };
  }

  /** All valid names currently owned by an address (auto-discovery for 'own' mode). */
  async listNamesOwnedBy(address: string): Promise<OwnedName[]> {
    return this.bnsApi.getNamesOwnedBy(address.trim());
  }

  /** Renewal price in micro-STX (what `name-renewal` will burn from the caller). */
  async getRenewalPriceUstx(fqn: string): Promise<bigint> {
    const { name, namespace } = splitFqn(fqn);
    return this.hiro.getNamePriceUstx(name, namespace);
  }
}
