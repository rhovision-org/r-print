import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DeployRejected,
  HttpTransport,
  waitFinalized,
  type NodeTransport,
} from "../lib/node-client";

interface Call {
  url: string;
  init?: RequestInit;
}

function response(status: number, body: string, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  } as unknown as Response;
}

function fakeFetch(
  replies: Array<Response | ((call: Call) => Response)>,
  calls: Call[],
): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (!reply) throw new Error("no reply configured");
    return typeof reply === "function" ? reply(call) : reply;
  }) as unknown as typeof fetch;
}

describe("HttpTransport", () => {
  it("reads status and height", async () => {
    const calls: Call[] = [];
    const transport = new HttpTransport(
      "http://node/",
      fakeFetch(
        [response(200, JSON.stringify({ networkId: "n", shardId: "/root", latestBlockNumber: 4 }))],
        calls,
      ),
    );
    expect(await transport.height()).toBe(4);
    expect(calls[0]?.url).toBe("http://node/api/v1/status");
  });

  it("posts a bare JSON string to explore-deploy", async () => {
    const calls: Call[] = [];
    const transport = new HttpTransport(
      "http://node",
      fakeFetch(
        [
          response(
            200,
            JSON.stringify({
              expr: [{ ExprString: { data: "ok" } }],
              block: { blockHash: "b", blockNumber: 1 },
              replySource: "firstPrivateName",
            }),
          ),
        ],
        calls,
      ),
    );
    const result = await transport.explore("Nil");
    expect(JSON.parse(String(calls[0]?.init?.body))).toBe("Nil");
    expect(result.replySource).toBe("firstPrivateName");
  });

  it("submits the exact signed body and treats duplicate as accepted", async () => {
    const calls: Call[] = [];
    const transport = new HttpTransport(
      "http://node",
      fakeFetch([response(200, '"id"'), response(400, "duplicate deploy")], calls),
    );
    await transport.submit({ term: "Nil" });
    await transport.submit({ term: "Nil" });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ term: "Nil" });
  });

  it("throws DeployRejected for a real rejection", async () => {
    const transport = new HttpTransport(
      "http://node",
      fakeFetch([response(400, "bad signature")], []),
    );
    await expect(transport.submit({})).rejects.toBeInstanceOf(DeployRejected);
  });

  it("decodes deploy status variants and finality", async () => {
    const calls: Call[] = [];
    const transport = new HttpTransport(
      "http://node",
      fakeFetch(
        [
          response(
            200,
            JSON.stringify({
              ProcessedWithSuccess: {
                deployResult: [],
                block: { blockHash: "b", blockNumber: 1 },
              },
            }),
          ),
          response(200, "true"),
        ],
        calls,
      ),
    );
    const status = await transport.deployStatus("id");
    expect("ProcessedWithSuccess" in status).toBe(true);
    expect(await transport.isFinalized("b")).toBe(true);
  });

  it("retries a retryable read", async () => {
    const calls: Call[] = [];
    const transport = new HttpTransport(
      "http://node",
      fakeFetch([response(503, "busy"), response(200, "true")], calls),
    );
    expect(await transport.isFinalized("b")).toBe(true);
    expect(calls).toHaveLength(2);
  }, 5_000);

  it("rejects an empty node URL", () => {
    expect(() => new HttpTransport("  ")).toThrow(ConfigError);
  });
});

describe("waitFinalized", () => {
  it("polls until the block is final", async () => {
    let calls = 0;
    const transport = {
      isFinalized: async () => {
        calls += 1;
        return calls > 1;
      },
    } as unknown as NodeTransport;
    await waitFinalized(transport, "deploy", "block", 5_000);
    expect(calls).toBeGreaterThan(1);
  });
});
