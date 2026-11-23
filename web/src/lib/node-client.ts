/**
 * The node HTTP boundary.
 *
 * Everything here is framework-free so the same transport runs in the browser, in vitest
 * with a fake `fetch`, and in the Node live script. Reads are explore-deploys; writes are
 * signed deploys. Finality is a separate route and is enforced in `LiveApi`.
 */

export interface NodeStatus {
  networkId: string;
  shardId: string;
  latestBlockNumber: number;
  autopropose?: boolean;
  proposeOnDeploy?: boolean;
  manualPropose?: boolean;
  devMode?: boolean;
  acceptsDeploys?: boolean;
  degraded?: string;
  [key: string]: unknown;
}

export interface BlockRef {
  blockHash: string;
  blockNumber: number;
}

export interface ExploreResult {
  expr: unknown[];
  block: BlockRef;
  replySource: string;
}

export type DeployStatus =
  | { ProcessedWithSuccess: { deployResult: unknown[]; block: BlockRef } }
  | { ProcessedWithError: { deployError: string; block: BlockRef } }
  | { NotProcessed: { status: string } };

export class TransportError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = "TransportError";
    this.status = status;
    this.retryable = retryable;
  }
}

export class DeployRejected extends Error {
  constructor(readonly body: string, readonly status: number) {
    super(`deploy rejected (${status}): ${body}`);
    this.name = "DeployRejected";
  }
}

export class DeployFailed extends Error {
  constructor(readonly deployError: string, readonly block: BlockRef) {
    super(`deploy ${block.blockHash} failed: ${deployError}`);
    this.name = "DeployFailed";
  }
}

export class ProcessedTimeout extends Error {
  constructor(
    readonly deployId: string,
    readonly last = "not processed",
  ) {
    super(`deploy ${deployId} was not processed before the timeout (${last})`);
    this.name = "ProcessedTimeout";
  }
}

export class FinalityTimeout extends Error {
  constructor(readonly deployId: string, readonly blockHash: string) {
    super(`deploy ${deployId} processed in ${blockHash} but the block did not finalize`);
    this.name = "FinalityTimeout";
  }
}

export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecodeError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface NodeTransport {
  status(): Promise<NodeStatus>;
  height(): Promise<number>;
  explore(term: string): Promise<ExploreResult>;
  submit(body: unknown): Promise<void>;
  deployStatus(deployId: string): Promise<DeployStatus>;
  isFinalized(blockHash: string): Promise<boolean>;
  faucet(address: string): Promise<unknown>;
}

type FetchImpl = typeof fetch;

const MAX_READ_ATTEMPTS = 3;

/** The real node transport. `fetchImpl` is injectable for tests. */
export class HttpTransport implements NodeTransport {
  private readonly base: string;

  constructor(
    baseUrl: string,
    // Call fetch through globalThis: a bare stored `fetch` loses the Window receiver
    // and browsers reject it with "Illegal invocation".
    private readonly fetchImpl: FetchImpl = (input, init) =>
      globalThis.fetch(input, init),
  ) {
    if (!baseUrl.trim()) {
      throw new ConfigError("node URL is empty");
    }
    this.base = baseUrl.replace(/\/+$/, "");
  }

  async status(): Promise<NodeStatus> {
    return this.getJson<NodeStatus>("/api/v1/status");
  }

  async height(): Promise<number> {
    const status = await this.status();
    if (typeof status.latestBlockNumber !== "number") {
      throw new DecodeError("status has no latestBlockNumber");
    }
    return status.latestBlockNumber;
  }

  async explore(term: string): Promise<ExploreResult> {
    return this.postJson<ExploreResult>(
      "/api/v1/explore-deploy",
      JSON.stringify(term),
      true,
    );
  }

  async submit(body: unknown): Promise<void> {
    const response = await this.request("/api/v1/deploy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      const lower = text.toLowerCase();
      if (lower.includes("duplicate") || (lower.includes("already") && lower.includes("deploy"))) {
        return;
      }
      throw new DeployRejected(text, response.status);
    }
  }

  async deployStatus(deployId: string): Promise<DeployStatus> {
    return this.getJson<DeployStatus>(`/api/v1/deploy-status/${deployId}`);
  }

  async isFinalized(blockHash: string): Promise<boolean> {
    const value = await this.getText(`/api/is-finalized/${blockHash}`);
    try {
      return JSON.parse(value) === true;
    } catch {
      throw new DecodeError(`is-finalized returned ${value}`);
    }
  }

  async faucet(address: string): Promise<unknown> {
    return this.postJson<unknown>("/api/v1/faucet", JSON.stringify({ address }), false);
  }

  private async getJson<T>(path: string): Promise<T> {
    const text = await this.getText(path);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new DecodeError(`${path} did not return JSON`);
    }
  }

  private async getText(path: string): Promise<string> {
    let last: unknown;
    for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt += 1) {
      const response = await this.request(path, { method: "GET" });
      const text = await response.text();
      if (response.ok) return text;
      const error = new TransportError(
        `${path}: ${response.status} ${text}`,
        response.status,
        response.status === 429 || response.status === 503,
      );
      last = error;
      if (!error.retryable) throw error;
      await sleep(backoff(attempt, response.headers.get("retry-after")));
    }
    throw last instanceof Error ? last : new TransportError(`${path}: exhausted retries`);
  }

  private async postJson<T>(path: string, body: string, retry: boolean): Promise<T> {
    let last: unknown;
    const attempts = retry ? MAX_READ_ATTEMPTS : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await this.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await response.text();
      if (response.ok) {
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new DecodeError(`${path} did not return JSON`);
        }
      }
      const error = new TransportError(
        `${path}: ${response.status} ${text}`,
        response.status,
        response.status === 429 || response.status === 503,
      );
      last = error;
      if (!error.retryable) throw error;
      await sleep(backoff(attempt, response.headers.get("retry-after")));
    }
    throw last instanceof Error ? last : new TransportError(`${path}: exhausted retries`);
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return this.fetchImpl(`${this.base}${path}`, init).catch((error: unknown) => {
      throw new TransportError(
        `network error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        true,
      );
    });
  }
}

function backoff(attempt: number, retryAfter: string | null): number {
  const header = retryAfter ? Number(retryAfter) * 1000 : 0;
  return Math.max(header, 250 * 2 ** attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll a deploy until it is processed or the timeout expires. */
export async function waitProcessed(
  transport: NodeTransport,
  deployId: string,
  timeoutMs: number,
): Promise<DeployStatus> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let last = "not processed";
  while (Date.now() < deadline) {
    const status = await transport.deployStatus(deployId);
    if (!("NotProcessed" in status)) return status;
    last = status.NotProcessed.status;
    await sleep(250 * 2 ** Math.min(attempt, 5));
    attempt += 1;
  }
  throw new ProcessedTimeout(deployId, last);
}

/** Poll finality until the block is final or the timeout expires. */
export async function waitFinalized(
  transport: NodeTransport,
  deployId: string,
  blockHash: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    if (await transport.isFinalized(blockHash)) return;
    await sleep(250 * 2 ** Math.min(attempt, 5));
    attempt += 1;
  }
  throw new FinalityTimeout(deployId, blockHash);
}
