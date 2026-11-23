/**
 * Live-only helpers that are not members of `RprintApi`: fetch the canonical admin payload
 * from the deployed `Codec` so signatures bind exactly the text the contract verifies.
 */

import { ConfigError } from "./node-client";
import type { NodeTransport } from "./node-client";
import type { WasmBridge } from "./wasm-bridge";
import type { Reply, ResolveResult } from "./types";

export interface PayloadResult {
  payload: string;
}

export class LiveExtras {
  constructor(
    private readonly bridge: WasmBridge,
    private readonly transport: NodeTransport,
    private readonly resolve: (key: string) => Promise<Reply<ResolveResult>>,
  ) {}

  /** `rprint:admin:v1|publication:<id>|<nonce>|<action>|<args>` from the deployed Codec. */
  async adminPayloadFor(
    publicationId: string,
    nonce: number,
    action: string,
    args: unknown,
  ): Promise<Reply<PayloadResult>> {
    return this.payloadFor(`publication:${publicationId}`, nonce, action, args);
  }

  /** `rprint:admin:v1|commission:<escrowId>|<nonce>|split|<id>,<bps>`. */
  async arbitratePayloadFor(
    escrowId: string,
    nonce: number,
    writerBps: number,
  ): Promise<Reply<PayloadResult>> {
    return this.payloadFor(`commission:${escrowId}`, nonce, "split", [
      escrowId,
      writerBps,
    ]);
  }

  async payloadFor(
    domain: string,
    nonce: number,
    action: string,
    args: unknown,
  ): Promise<Reply<PayloadResult>> {
    const codec = await this.resolve("component:codec");
    if (!codec.ok) throw new ConfigError(`cannot resolve component:codec (${codec.reason})`);
    const term = this.bridge.buildTerm({
      op: "read",
      uri: codec.value.uri,
      binding: "adminPayload",
      args: [domain, nonce, action, args],
    });
    const result = await this.transport.explore(term);
    if (!result.expr.length) {
      throw new ConfigError("Codec adminPayload returned no value");
    }
    const decoded = this.bridge.decodeReply(result.expr[0]);
    if (!decoded.ok) return { ok: false, reason: decoded.reason ?? "refused" };
    const payload = decoded.values?.[0];
    if (typeof payload !== "string") {
      throw new ConfigError("Codec adminPayload did not return a string");
    }
    return { ok: true, value: { payload } };
  }
}
