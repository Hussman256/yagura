import { DEFAULT_BNSV2_API_BASE } from "./constants.js";
import { fetchJson, type FetchJsonOptions } from "./http.js";
import type { NamespaceProps, OwnedName } from "./types.js";

/**
 * Client for the BNS V2 indexer API (api.bnsv2.com, by Strata Labs — the same
 * API that backs the official bns-v2-sdk). This is Yagura's primary read path
 * because one request returns the name record AND the current burn block
 * together, which keeps status derivation consistent. Direct on-chain reads
 * via the Hiro API (see hiro.ts) remain available as a fallback.
 *
 * The API returns uints as strings; everything is parsed to numbers here so
 * the rest of the codebase never touches raw wire shapes.
 */

/** Raw name record as returned inside `/names/{fqn}` and address listings. */
interface RawNameRecord {
  full_name: string;
  name_string: string;
  namespace_string: string;
  owner: string;
  renewal_height: string;
  imported_at?: string; // "none" or a height string
  revoked: boolean;
}

interface RawNameResponse {
  current_burn_block: number;
  is_managed: boolean;
  data: RawNameRecord;
}

interface RawNamespaceResponse {
  current_burn_block: number;
  namespace: {
    namespace_string: string;
    launched_at: string;
    lifetime: string;
    namespace_manager: string; // "none" or a principal
  };
}

interface RawAddressNamesResponse {
  total: number;
  current_burn_block: number;
  names: RawNameRecord[];
}

/** Parsed result of a single-name lookup. */
export interface BnsApiName {
  fqn: string;
  name: string;
  namespace: string;
  owner: string;
  /** Raw renewal height from the record; 0 is the "imported" sentinel. */
  renewalHeight: number;
  /** Burn height the name was imported at, or null if not imported. */
  importedAt: number | null;
  revoked: boolean;
  isManaged: boolean;
  currentBurnBlock: number;
}

/** "none" | "123" → null | 123 */
function optionalUint(value: string | undefined): number | null {
  if (value === undefined || value === "none") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface BnsApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class BnsApiClient {
  private readonly baseUrl: string;
  private readonly fetchOptions: FetchJsonOptions;

  constructor(options: BnsApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BNSV2_API_BASE).replace(
      /\/$/,
      "",
    );
    this.fetchOptions = options.fetchImpl
      ? { fetchImpl: options.fetchImpl }
      : {};
  }

  /** Look up one name. Returns null when the name has never been registered. */
  async getName(fqn: string): Promise<BnsApiName | null> {
    const response = await fetchJson<RawNameResponse>(
      `${this.baseUrl}/names/${encodeURIComponent(fqn)}`,
      this.fetchOptions,
    );
    if (response === null) return null;
    const { data } = response;
    return {
      fqn: data.full_name,
      name: data.name_string,
      namespace: data.namespace_string,
      owner: data.owner,
      renewalHeight: Number(data.renewal_height),
      importedAt: optionalUint(data.imported_at),
      revoked: data.revoked,
      isManaged: response.is_managed,
      currentBurnBlock: response.current_burn_block,
    };
  }

  /** Namespace properties (lifetime, launch height, manager). Null if unknown. */
  async getNamespace(namespace: string): Promise<NamespaceProps | null> {
    const response = await fetchJson<RawNamespaceResponse>(
      `${this.baseUrl}/namespaces/${encodeURIComponent(namespace)}`,
      this.fetchOptions,
    );
    if (response === null) return null;
    const raw = response.namespace;
    return {
      namespace: raw.namespace_string,
      lifetime: Number(raw.lifetime),
      launchedAt: optionalUint(raw.launched_at),
      manager:
        raw.namespace_manager === "none" ? null : raw.namespace_manager,
    };
  }

  /**
   * All currently-valid names owned by a Stacks address, following the API's
   * pagination to the end. Used by the poller to auto-discover names for
   * tracked addresses.
   */
  async getNamesOwnedBy(address: string): Promise<OwnedName[]> {
    const pageSize = 50;
    const names: OwnedName[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const response = await fetchJson<RawAddressNamesResponse>(
        `${this.baseUrl}/names/address/${encodeURIComponent(address)}/valid?limit=${pageSize}&offset=${offset}`,
        this.fetchOptions,
      );
      if (response === null) break;
      for (const record of response.names) {
        names.push({
          fqn: record.full_name,
          name: record.name_string,
          namespace: record.namespace_string,
          renewalHeight:
            Number(record.renewal_height) > 0
              ? Number(record.renewal_height)
              : null,
        });
      }
      if (names.length >= response.total || response.names.length === 0) break;
    }
    return names;
  }
}
