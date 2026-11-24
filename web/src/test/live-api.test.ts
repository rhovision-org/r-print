import { describe, expect, it } from "vitest";
import { MemoryDeployLog } from "../lib/deploy-log";
import {
  DeployFailed,
  FinalityTimeout,
  type DeployStatus,
  type ExploreResult,
  type NodeStatus,
  type NodeTransport,
} from "../lib/node-client";
import { LiveApi, WalletLockedError } from "../lib/live-api";
import type {
  DecodedReply,
  EditionManifestInput,
  SignOptions,
  SignedDeployWire,
  WalletInfo,
  WasmBridge,
} from "../lib/wasm-bridge";
import type { LiveConfig, Reply } from "../lib/types";

class FakeBridge implements WasmBridge {
  unlocked = true;
  terms: unknown[] = [];
  signatures: string[] = [];
  wallet: WalletInfo = { address: "1111test", publicKey: "04aa" };

  version = () => "0.1.0";
  isUnlocked = () => this.unlocked;
  info = () => (this.unlocked ? this.wallet : null);
  lockWallet = () => {
    this.unlocked = false;
  };
  unlockWallet = () => {
    this.unlocked = true;
    return this.wallet;
  };
  createWallet = () => {
    this.unlocked = true;
    return { ...this.wallet, document: "{\"version\":3}" };
  };
  exportKeystore = () => "{\"version\":3}";
  buildTerm = (request: unknown) => {
    this.terms.push(request);
    const record = request as { op?: string; binding?: string };
    return `TERM:${record.op ?? "unknown"}:${record.binding ?? ""}`;
  };
  decodeReply = (expr: unknown) => expr as DecodedReply;
  signDeploy = (term: string, options: SignOptions): SignedDeployWire => ({
    deployId: "deploy-1",
    body: { term, options },
  });
  signTextPayload = (payload: string) => {
    this.signatures.push(payload);
    return "signature";
  };
  signEditionManifest = (_input: EditionManifestInput) => ({
    manifestHash: "manifest-hash",
    signature: "edition-signature",
  });
  signWithKeystore = () => ({ publicKey: "04aa", signature: "signature" });
}

class FakeTransport implements NodeTransport {
  explored: string[] = [];
  submitted: unknown[] = [];
  exploredReply: DecodedReply = { ok: true, values: [{}] };
  statusReply: DeployStatus = {
    ProcessedWithSuccess: {
      deployResult: [{ ok: true, values: [] }],
      block: { blockHash: "block-1", blockNumber: 7 },
    },
  };
  finalized = true;
  stat: NodeStatus = {
    networkId: "testnet",
    shardId: "/root",
    latestBlockNumber: 11,
    autopropose: true,
    acceptsDeploys: true,
  };

  async status() {
    return this.stat;
  }
  async height() {
    return 11;
  }
  async explore(term: string): Promise<ExploreResult> {
    this.explored.push(term);
    return {
      expr: [this.exploredReply],
      block: { blockHash: "block-0", blockNumber: 10 },
      replySource: "firstPrivateName",
    };
  }
  async submit(body: unknown) {
    this.submitted.push(body);
  }
  async deployStatus() {
    return this.statusReply;
  }
  async isFinalized() {
    return this.finalized;
  }
  async faucet() {
    return { status: "pending" };
  }
}

const CONFIG: LiveConfig = {
  nodeUrl: "http://node",
  rootUri: "rho:id:root",
  shardId: "/root",
  phloLimit: 4_000_000,
  phloPrice: 1,
  processedTimeoutMs: 50,
  finalityTimeoutMs: 50,
  componentUris: {
    "component:publication-factory": "rho:id:publication-factory",
    "component:commission-factory": "rho:id:commission-factory",
    "component:article-factory": "rho:id:article-factory",
    "component:edition-factory": "rho:id:edition-factory",
    "component:coordination-factory": "rho:id:coordination-factory",
  },
};

function setup() {
  const bridge = new FakeBridge();
  const transport = new FakeTransport();
  const log = new MemoryDeployLog();
  const api = new LiveApi({ bridge, transport, config: CONFIG, log });
  return { bridge, transport, log, api };
}

describe("LiveApi reads", () => {
  it("resolves a component from the root", async () => {
    const { api, transport } = setup();
    transport.exploredReply = { ok: true, values: ["rho:id:payments", 1] };
    const reply = await api.resolveComponent("component:payments");
    expect(reply).toEqual({
      ok: true,
      value: { component: "component:payments", uri: "rho:id:payments", version: 1 },
    });
    expect(transport.explored[0]).toContain("TERM:read:");
  });

  it("maps network status without inventing a health score", async () => {
    const { api } = setup();
    expect(await api.networkStatus()).toEqual({
      ok: true,
      value: {
        node: "http://node",
        networkId: "testnet",
        shardId: "/root",
        latestBlockNumber: 11,
        acceptsDeploys: true,
        degraded: "",
      },
    });
  });

  it("defaults omitted Nil fields", async () => {
    const { api, transport } = setup();
    transport.exploredReply = {
      ok: true,
      values: [
        {
          publicationId: "pub:1",
          charterHash: "ch",
          status: "active",
          admins: ["04aa"],
          threshold: 1,
          nonce: 0,
          charter: {
            nameHash: "n",
            mastheadHash: "m",
            taglineHash: "",
            treasuryAccountId: "1111t",
            assetId: "REV",
            revenueSplit: [],
            admins: ["04aa"],
            threshold: 1,
            governance: { maxMembers: 32 },
          },
          members: { "1111m": { role: "writer" } },
        },
      ],
    };
    const info = await api.publicationInfo("rho:id:p");
    expect(info.ok).toBe(true);
    if (!info.ok) return;
    expect(info.value.coverUri).toBeUndefined();
    expect(info.value.charter.governance.maxMembers).toBe(32);
    expect(info.value.members["1111m"]?.status).toBe("active");
  });

  it("maps arbitration and a coordination record", async () => {
    const { api, transport } = setup();
    transport.exploredReply = { ok: true, values: ["platform", ["04aa", "04bb"], 2] };
    expect(await api.publicationArbitration("rho:id:p")).toEqual({
      ok: true,
      value: { kind: "platform", keys: ["04aa", "04bb"], threshold: 2 },
    });
    transport.exploredReply = {
      ok: true,
      values: [{
        coordinationId: "coord:1",
        publicationId: "pub:1",
        publicationUri: "rho:id:p",
        subjectRef: { kind: "publication", id: "pub:1", uri: "rho:id:p" },
        roomIdHash: "room",
        pollIdHash: "poll",
        outcomeHash: "outcome",
        signers: ["1111a"],
        signatures: [{ by: "1111a", sig: "00", atHeight: 2 }],
        status: "recorded",
        createdBy: "1111a",
        createdAtHeight: 1,
        recordedAtHeight: 2,
      }],
    };
    const coordination = await api.coordinationInfo("rho:id:c");
    expect(coordination.ok).toBe(true);
    if (!coordination.ok) return;
    expect(coordination.value.status).toBe("recorded");
    expect(coordination.value.signatures).toHaveLength(1);
  });

  it("treats an empty explore result as a decode error", async () => {
    const { api, transport } = setup();
    transport.exploredReply = { ok: true, values: [] };
    transport.explore = async () => ({
      expr: [],
      block: { blockHash: "b", blockNumber: 1 },
      replySource: "none",
    });
    await expect(api.publicationInfo("rho:id:p")).rejects.toThrow(/no reply/);
  });
});

describe("LiveApi writes", () => {
  const writes: Array<[string, (api: LiveApi) => Promise<Reply<unknown>>, string]> = [
    [
      "createPublication",
      (api) =>
        api.createPublication({
          publicationId: "pub:1",
          opId: "op:1",
          charter: {
            nameHash: "n",
            mastheadHash: "m",
            taglineHash: "",
            foundedAtHeight: 0,
            treasuryAccountId: "1111t",
            assetId: "REV",
            revenueSplit: [],
            admins: ["04aa"],
            threshold: 1,
            governance: {
              maxMembers: 32,
              requireFactCheck: false,
              disputeWindowBlocks: 10,
              commissionGraceBlocks: 5,
            },
          },
          members: [
            {
              memberId: "1111t",
              role: "publisher",
              did: "byoid:rev:1111t",
              attestationHash: "",
            },
          ],
        }),
      "createPublication",
    ],
    ["addMember", (api) => api.addMember("rho:id:p", { opId: "op", memberId: "1111m", role: "writer", did: "did:byoid:x", attestationHash: "" }), "addMember"],
    ["removeMember", (api) => api.removeMember("rho:id:p", { opId: "op", memberId: "1111m" }), "removeMember"],
    ["setRole", (api) => api.setRole("rho:id:p", { opId: "op", memberId: "1111m", role: "editor" }), "setRole"],
    ["attestSelf", (api) => api.attestSelf("rho:id:p", { opId: "op", memberId: "", did: "did:byoid:x", attestationHash: "a" }), "attestSelf"],
    ["pausePublication", (api) => api.pausePublication("rho:id:p", { opId: "op", paused: true }), "pausePublication"],
    ["publicationAdmin", (api) => api.publicationAdmin("rho:id:p", { nonce: 1, action: "pause", args: [], sigs: [] }), "publicationAdmin"],
    ["attachCover", (api) => api.attachCover("rho:id:c", { opId: "op", coverUri: "rho:id:policy" }), "attachCover"],
    [
      "proposeCommission",
      (api) =>
        api.proposeCommission({
          proposalId: "prop:1",
          opId: "op",
          publicationId: "pub:1",
          publicationUri: "rho:id:p",
          writerDid: "did:byoid:w",
          titleHash: "t",
          briefHash: "b",
          total: 10,
          milestones: [{ id: "m1", kind: "draft", amount: 10, deadlineHeight: 20 }],
          graceBlocks: 5,
          disputeWindowBlocks: 10,
          requireFactCheck: false,
        }),
      "proposeCommission",
    ],
    ["acceptProposal", (api) => api.acceptProposal("rho:id:c", { opId: "op" }), "acceptProposal"],
    ["fundProposal", (api) => api.fundProposal("rho:id:c", { opId: "op" }), "fundProposal"],
    ["cancelProposal", (api) => api.cancelProposal("rho:id:c", { opId: "op", reasonHash: "r" }), "cancelProposal"],
    ["submitMilestone", (api) => api.submitMilestone("rho:id:e", { opId: "op", milestoneId: "m1", evidenceHash: "e" }), "submitMilestone"],
    ["releaseMilestone", (api) => api.releaseMilestone("rho:id:e", { opId: "op", milestoneId: "m1" }), "releaseMilestone"],
    ["cancelEscrow", (api) => api.cancelEscrow("rho:id:e", { opId: "op", reasonHash: "r" }), "cancelEscrow"],
    ["disputeEscrow", (api) => api.disputeEscrow("rho:id:e", { opId: "op", reasonHash: "r" }), "disputeEscrow"],
    ["arbitrateEscrow", (api) => api.arbitrateEscrow("rho:id:e", { nonce: 1, writerBps: 5000, sigs: ["aa"], opId: "op" }), "arbitrateEscrow"],
    ["expireEscrow", (api) => api.expireEscrow("rho:id:e", { opId: "op" }), "expireEscrow"],
    ["resolveDispute", (api) => api.resolveDispute("rho:id:e", { opId: "op" }), "resolveDispute"],
    [
      "createArticle",
      (api) =>
        api.createArticle({
          articleId: "a:1",
          opId: "op",
          publicationId: "pub:1",
          publicationUri: "rho:id:p",
          authors: [{ memberId: "1111m", did: "did:byoid:x", bylineHash: "b" }],
          contentHash: "h",
          license: "cc-by-4.0",
          customLicenseHash: "",
          access: "open",
          sectionHash: "s",
          requireFactCheck: false,
          requireKAsset: false,
        }),
      "createArticle",
    ],
    ["submitArticle", (api) => api.submitArticle("rho:id:a", { opId: "op", contentHash: "h" }), "submitArticle"],
    ["attachKnowledge", (api) => api.attachKnowledge("rho:id:a", { opId: "op", kassetUri: "k", claimUri: "c", provenanceUri: "p", credentialUri: "" }), "attachKnowledge"],
    ["attestArticle", (api) => api.attestArticle("rho:id:a", { opId: "op", attestationId: "at", kind: "factcheck", evidenceHash: "e" }), "attestArticle"],
    ["approveArticle", (api) => api.approveArticle("rho:id:a", { opId: "op" }), "approveArticle"],
    ["publishArticle", (api) => api.publishArticle("rho:id:a", { opId: "op" }), "publishArticle"],
    ["correctArticle", (api) => api.correctArticle("rho:id:a", { opId: "op", correctionId: "c", kind: "correction", bodyHash: "b", reasonHash: "r" }), "correctArticle"],
    ["retractArticle", (api) => api.retractArticle("rho:id:a", { opId: "op", reasonHash: "r" }), "retractArticle"],
    ["createEdition", (api) => api.createEdition({ editionId: "ed", opId: "op", publicationId: "pub:1", publicationUri: "rho:id:p", number: 1, titleHash: "t", coverHash: "c" }), "createEdition"],
    ["appendEditionArticle", (api) => api.appendEditionArticle("rho:id:ed", { opId: "op", articleUri: "rho:id:a" }), "appendEditionArticle"],
    ["sealEdition", (api) => api.sealEdition("rho:id:ed", { opId: "op", editorSig: "aa" }), "sealEdition"],
    [
      "createCoordination",
      (api) =>
        api.createCoordination({
          opId: "op",
          coordinationId: "coord:1",
          publicationId: "pub:1",
          publicationUri: "rho:id:p",
          subjectKind: "publication",
          subjectId: "pub:1",
          subjectUri: "rho:id:p",
          roomIdHash: "room",
          signerIds: ["1111a"],
        }),
      "createCoordination",
    ],
    [
      "recordCoordination",
      (api) =>
        api.recordCoordination("rho:id:c", {
          opId: "op",
          coordinationId: "coord:1",
          pollIdHash: "poll",
          outcomeHash: "outcome",
          signatures: [{ memberId: "1111a", pubKey: "02aa", sig: "3044" }],
        }),
      "recordCoordination",
    ],
  ];

  it.each(writes)("%s signs, submits and requires finality", async (_label, call, op) => {
    const { api, bridge, transport, log } = setup();
    const reply = await call(api);
    expect(reply.ok).toBe(true);
    expect(transport.submitted).toHaveLength(1);
    expect(bridge.terms.at(-1)).toMatchObject({ op });
    expect(log.list()[0]?.status).toBe("finalized");
  });

  it("keeps keystore operations in the bridge", async () => {
    const { api, bridge, transport } = setup();
    const created = await api.keystoreCreate({ password: "pw" });
    expect(created.ok).toBe(true);
    expect(transport.submitted).toHaveLength(0);
    expect(bridge.unlocked).toBe(true);
    const unlocked = await api.keystoreUnlock({ password: "pw", document: "{}" });
    expect(unlocked.ok).toBe(true);
  });

  it("returns a refusal as a Reply instead of throwing", async () => {
    const { api, transport, log } = setup();
    transport.statusReply = {
      ProcessedWithSuccess: {
        deployResult: [{ ok: false, reason: "status" }],
        block: { blockHash: "block-2", blockNumber: 8 },
      },
    };
    const reply = await api.publishArticle("rho:id:a", { opId: "op" });
    expect(reply).toEqual({ ok: false, reason: "status" });
    expect(log.list()[0]?.status).toBe("refused");
  });

  it("throws on processed-with-error and on finality timeout", async () => {
    const first = setup();
    first.transport.statusReply = {
      ProcessedWithError: {
        deployError: "boom",
        block: { blockHash: "block-3", blockNumber: 9 },
      },
    };
    await expect(first.api.publishArticle("rho:id:a", { opId: "op" })).rejects.toBeInstanceOf(
      DeployFailed,
    );

    const second = setup();
    second.transport.finalized = false;
    await expect(second.api.publishArticle("rho:id:a", { opId: "op" })).rejects.toBeInstanceOf(
      FinalityTimeout,
    );
  });

  it("refuses to write with a locked wallet", async () => {
    const { api, bridge } = setup();
    bridge.unlocked = false;
    await expect(api.publishArticle("rho:id:a", { opId: "op" })).rejects.toBeInstanceOf(
      WalletLockedError,
    );
  });
});
