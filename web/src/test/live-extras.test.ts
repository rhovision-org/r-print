import { describe, expect, it } from "vitest";
import { LiveExtras } from "../lib/live-extras";
import type { ExploreResult, NodeTransport } from "../lib/node-client";
import type { DecodedReply, WasmBridge } from "../lib/wasm-bridge";
import type { Reply } from "../lib/types";

class Bridge implements WasmBridge {
  requests: unknown[] = [];
  version = () => "0.1.0";
  createWallet = () => ({ address: "1111a", publicKey: "04aa", document: "{}" });
  unlockWallet = () => ({ address: "1111a", publicKey: "04aa" });
  lockWallet = () => undefined;
  isUnlocked = () => true;
  info = () => ({ address: "1111a", publicKey: "04aa" });
  exportKeystore = () => "{}";
  buildTerm = (request: unknown) => {
    this.requests.push(request);
    return "TERM";
  };
  decodeReply = () => ({ ok: true, values: ["rprint:admin:v1|payload"] }) as DecodedReply;
  signDeploy = () => ({ deployId: "d", body: {} });
  signTextPayload = () => "sig";
  signEditionManifest = () => ({ manifestHash: "h", signature: "s" });
  signWithKeystore = () => ({ publicKey: "04aa", signature: "s" });
}

const transport = {
  explore: async (_term: string): Promise<ExploreResult> => ({
    expr: [{ ok: true, values: ["rprint:admin:v1|payload"] }],
    block: { blockHash: "b", blockNumber: 1 },
    replySource: "firstPrivateName",
  }),
} as unknown as NodeTransport;

const resolve = async (key: string): Promise<Reply<{ component: string; uri: string; version: number }>> =>
  key === "component:codec"
    ? { ok: true, value: { component: key, uri: "rho:id:codec", version: 1 } }
    : { ok: false, reason: "unknown component" };

describe("LiveExtras payloads", () => {
  it("reads the publication admin payload from the Codec", async () => {
    const bridge = new Bridge();
    const extras = new LiveExtras(bridge, transport, resolve);
    const reply = await extras.adminPayloadFor("pub:1", 3, "pause", []);
    expect(reply).toEqual({ ok: true, value: { payload: "rprint:admin:v1|payload" } });
    expect(bridge.requests[0]).toMatchObject({
      op: "read",
      uri: "rho:id:codec",
      binding: "adminPayload",
      args: ["publication:pub:1", 3, "pause", []],
    });
  });

  it("reads the arbitration split payload with the escrow id and bps", async () => {
    const bridge = new Bridge();
    const extras = new LiveExtras(bridge, transport, resolve);
    await extras.arbitratePayloadFor("esc:1", 2, 5000);
    expect(bridge.requests[0]).toMatchObject({
      args: ["commission:esc:1", 2, "split", ["esc:1", 5000]],
    });
  });
});
