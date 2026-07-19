/**
 * Minimal resilient HTTP helper shared by all API clients.
 *
 * Policy: up to 3 retries with exponential backoff + jitter on network
 * errors, 429s (honouring Retry-After when present), and 5xx responses.
 * 4xx responses other than 429 are returned to the caller — a 404 is an
 * answer ("name not found"), not a failure.
 */

export interface FetchJsonOptions {
  /** Extra request headers (e.g. Hiro API key). */
  headers?: Record<string, string>;
  /** POST body; when set the request is a POST with JSON content type. */
  body?: unknown;
  /** Per-attempt timeout in ms. */
  timeoutMs?: number;
  /** Max retry attempts after the first try. */
  retries?: number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    bodySnippet: string,
  ) {
    super(`HTTP ${status} from ${url}: ${bodySnippet.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON with retries. Returns the parsed body, or `null` on 404.
 * Throws {@link HttpError} for other non-OK statuses and the last network
 * error if all retries are exhausted.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T | null> {
  const {
    headers = {},
    body,
    timeoutMs = 15_000,
    retries = 3,
    fetchImpl = fetch,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // 500ms, 1s, 2s... plus jitter so parallel pollers don't stampede.
      await sleep(500 * 2 ** (attempt - 1) + Math.random() * 250);
    }
    try {
      const response = await fetchImpl(url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) return null;
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await sleep(Math.min(retryAfter, 30) * 1000);
        }
        lastError = new HttpError(
          response.status,
          url,
          await response.text().catch(() => ""),
        );
        continue;
      }
      if (!response.ok) {
        throw new HttpError(
          response.status,
          url,
          await response.text().catch(() => ""),
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
