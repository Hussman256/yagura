import { Cl, cvToJSON, hexToCV, serializeCV } from "@stacks/transactions";

import {
  BNS_V2_CONTRACT_ADDRESS,
  BNS_V2_CONTRACT_NAME,
  DEFAULT_HIRO_API_BASE,
} from "./constants.js";
import { fetchJson, type FetchJsonOptions } from "./http.js";

/**
 * Thin client for the Hiro Stacks Blockchain API — Yagura's direct line to
 * the chain. Used for the current burn block height, read-only calls against
 * the BNS-V2 contract (renewal price, fallback name resolution), and nothing
 * else. Base URL and API key are env-configurable; the public endpoint's
 * rate limits are respected via the shared retry/backoff policy in http.ts.
 */

interface ReadOnlyCallResponse {
  okay: boolean;
  result?: string;
  cause?: string;
}

export interface HiroClientOptions {
  baseUrl?: string;
  /** Optional Hiro API key; raises rate limits, sent as x-api-key. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class HiroClient {
  private readonly baseUrl: string;
  private readonly fetchOptions: FetchJsonOptions;

  constructor(options: HiroClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_HIRO_API_BASE).replace(
      /\/$/,
      "",
    );
    this.fetchOptions = {
      ...(options.apiKey ? { headers: { "x-api-key": options.apiKey } } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    };
  }

  /** Current Bitcoin burn block height, from the node's /v2/info. */
  async getBurnBlockHeight(): Promise<number> {
    const info = await fetchJson<{ burn_block_height: number }>(
      `${this.baseUrl}/v2/info`,
      this.fetchOptions,
    );
    if (info === null || !Number.isFinite(info.burn_block_height)) {
      throw new Error("Hiro /v2/info did not return a burn block height");
    }
    return info.burn_block_height;
  }

  /**
   * Execute a read-only function on the BNS-V2 contract and return the result
   * as the JSON produced by `cvToJSON` (callers pick apart the tuple/response
   * shapes they expect). Throws when the call itself fails.
   */
  async callBnsReadOnly(
    functionName: string,
    args: ReturnType<typeof Cl.bufferFromAscii>[],
  ): Promise<ReturnType<typeof cvToJSON>> {
    const url = `${this.baseUrl}/v2/contracts/call-read/${BNS_V2_CONTRACT_ADDRESS}/${BNS_V2_CONTRACT_NAME}/${functionName}`;
    const response = await fetchJson<ReadOnlyCallResponse>(url, {
      ...this.fetchOptions,
      body: {
        sender: BNS_V2_CONTRACT_ADDRESS,
        arguments: args.map((cv) => `0x${serializeCV(cv)}`),
      },
    });
    if (response === null || !response.okay || !response.result) {
      throw new Error(
        `read-only ${functionName} failed: ${response?.cause ?? "no result"}`,
      );
    }
    return cvToJSON(hexToCV(response.result));
  }

  /**
   * Renewal/registration price of a name in micro-STX, via the contract's
   * `get-name-price`. This is exactly what `name-renewal` will burn from the
   * caller, so the web app uses it to size the STX burn post-condition.
   */
  async getNamePriceUstx(name: string, namespace: string): Promise<bigint> {
    const json = await this.callBnsReadOnly("get-name-price", [
      Cl.bufferFromAscii(namespace),
      Cl.bufferFromAscii(name),
    ]);
    // Shape: (ok (ok uint)) — get-name-price wraps compute-name-price's response.
    let node: { success?: boolean; value?: unknown } = json as never;
    while (
      typeof node === "object" &&
      node !== null &&
      "value" in node &&
      typeof node.value === "object" &&
      node.value !== null
    ) {
      node = node.value as never;
    }
    const price = BigInt(String(node.value ?? node));
    if (price <= 0n) throw new Error("get-name-price returned a non-positive value");
    return price;
  }
}
