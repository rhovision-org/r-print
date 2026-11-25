/**
 * The live `RprintApi`.
 *
 * Reads are explore-deploys whose term replies on its first private name. Writes are signed
 * deploys; a write is a success only after the deploy is processed with success, its block
 * is final, and the reply is `(true, …)`. A `(false, reason)` reply is returned as a
 * refusal, not thrown. The key stays inside the WASM bridge.
 */

import type { RprintApi } from "./api";
import type { DeployLog } from "./deploy-log";
import { LiveExtras, type PayloadResult } from "./live-extras";
import { bytesValue } from "./op";
import {
  ConfigError,
  DecodeError,
  DeployFailed,
  ProcessedTimeout,
  waitFinalized,
  waitProcessed,
  type NodeTransport,
  type NodeStatus,
} from "./node-client";
import type { DecodedReply, SignOptions, WasmBridge } from "./wasm-bridge";
import type {
  AccountFunding,
  AdminInput,
  ArbitrationAuthority,
  ArbitrateInput,
  ArticleState,
  Attestation,
  AttestInput,
  CancelProposalInput,
  Charter,
  Correction,
  CorrectionInput,
  CoordinationState,
  CreateArticleInput,
  CreateCoordinationInput,
  CreateEditionInput,
  CreatePublicationInput,
  EditionEntry,
  EditionState,
  EscrowState,
  KeystoreInput,
  KeystoreResult,
  KnowledgeInput,
  LiveConfig,
  Member,
  MemberInput,
  Milestone,
  MilestoneActionInput,
  NetworkStatus,
  ProposeCommissionInput,
  ProposalState,
  PublicationState,
  RecordCoordinationInput,
  Reply,
  ResolveDisputeInput,
  ResolveResult,
  SealEditionInput,
} from "./types";

export class WalletLockedError extends Error {
  constructor(method: string) {
    super(`${method} requires an unlocked wallet`);
    this.name = "WalletLockedError";
  }
}

type ReadResult = { ok: true; values: unknown[] } | { ok: false; reason: string };

export interface LiveApiOptions {
  bridge: WasmBridge;
  transport: NodeTransport;
  config: LiveConfig;
  log: DeployLog;
}

export class LiveApi implements RprintApi, AccountFunding {
  private readonly components = new Map<string, string>();
  private readonly bridge: WasmBridge;
  private readonly transport: NodeTransport;
  private readonly config: LiveConfig;
  private readonly log: DeployLog;

  constructor(options: LiveApiOptions) {
    this.bridge = options.bridge;
    this.transport = options.transport;
    this.config = options.config;
    this.log = options.log;
  }

  // ---------------------------------------------------------------- reads

  async resolveComponent(key: string): Promise<Reply<ResolveResult>> {
    const configured = this.config.componentUris?.[key];
    if (configured) {
      return { ok: true, value: { component: key, uri: configured, version: 1 } };
    }
    if (!this.config.rootUri) {
      return { ok: false, reason: "root not configured" };
    }
    const reply = await this.readAll(this.config.rootUri, "resolve", [key, 1]);
    if (!reply.ok) return reply;
    const uri = str(reply.values[0]);
    if (!uri) return { ok: false, reason: "unavailable" };
    const version = num(reply.values[1], 1);
    this.components.set(key, uri);
    return { ok: true, value: { component: key, uri, version } };
  }

  async networkStatus(): Promise<Reply<NetworkStatus>> {
    const status = await this.transport.status();
    return { ok: true, value: networkStatus(status, this.config.nodeUrl) };
  }

  async publicationInfo(uri: string): Promise<Reply<PublicationState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: publicationInfo(reply.value) };
  }

  async publicationCharter(uri: string): Promise<Reply<Charter>> {
    const reply = await this.readReply(uri, "charter");
    if (!reply.ok) return reply;
    return { ok: true, value: charter(reply.value) };
  }

  async publicationMembers(uri: string): Promise<Reply<Record<string, Member>>> {
    const reply = await this.readReply(uri, "members");
    if (!reply.ok) return reply;
    return { ok: true, value: members(reply.value) };
  }

  async publicationArbitration(uri: string): Promise<Reply<ArbitrationAuthority>> {
    const reply = await this.readAll(uri, "arbitration");
    if (!reply.ok) return reply;
    const kind = str(reply.values[0], "publication");
    return {
      ok: true,
      value: {
        kind: kind === "platform" ? "platform" : "publication",
        keys: strings(reply.values[1]),
        threshold: num(reply.values[2]),
      },
    };
  }

  async commissionProposalInfo(uri: string): Promise<Reply<ProposalState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: proposal(reply.value) };
  }

  async escrowInfo(uri: string): Promise<Reply<EscrowState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: escrow(reply.value) };
  }

  async articleInfo(uri: string): Promise<Reply<ArticleState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: article(reply.value) };
  }

  async editionInfo(uri: string): Promise<Reply<EditionState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: edition(reply.value) };
  }

  async coordinationInfo(uri: string): Promise<Reply<CoordinationState>> {
    const reply = await this.readReply(uri, "info");
    if (!reply.ok) return reply;
    return { ok: true, value: coordination(reply.value) };
  }

  async createCoordination(
    input: CreateCoordinationInput,
  ): Promise<Reply<{ uri: string }>> {
    const factory = await this.component("component:coordination-factory");
    return this.write(
      "createCoordination",
      {
        op: "createCoordination",
        factoryUri: factory,
        opId: input.opId,
        coordinationId: input.coordinationId,
        data: {
          publicationId: input.publicationId,
          publicationUri: input.publicationUri,
          subjectRef: {
            kind: input.subjectKind,
            id: input.subjectId,
            uri: input.subjectUri,
          },
          roomIdHash: input.roomIdHash,
          signerIds: input.signerIds,
        },
      },
      factory,
      (values) => ({ uri: str(values[0]) }),
    );
  }

  async recordCoordination(
    uri: string,
    input: RecordCoordinationInput,
  ): Promise<Reply<null>> {
    return this.write("recordCoordination", {
      op: "recordCoordination",
      recordUri: uri,
      opId: input.opId,
      coordinationId: input.coordinationId,
      pollIdHash: input.pollIdHash,
      outcomeHash: input.outcomeHash,
      signatures: input.signatures.map((signer) => ({
        memberId: signer.memberId,
        pubKey: { $bytes: signer.pubKey },
        sig: { $bytes: signer.sig },
      })),
    }, uri);
  }

  /** Live-only: fetch the deployed Codec's canonical admin payload. */
  payloadFor(
    domain: string,
    nonce: number,
    action: string,
    args: unknown,
  ): Promise<Reply<PayloadResult>> {
    return this.extras().payloadFor(domain, nonce, action, args);
  }

  adminPayloadFor(
    publicationId: string,
    nonce: number,
    action: string,
    args: unknown,
  ): Promise<Reply<PayloadResult>> {
    return this.extras().adminPayloadFor(publicationId, nonce, action, args);
  }

  arbitratePayloadFor(
    escrowId: string,
    nonce: number,
    writerBps: number,
  ): Promise<Reply<PayloadResult>> {
    return this.extras().arbitratePayloadFor(escrowId, nonce, writerBps);
  }

  /**
   * Live-only: top up the unlocked key's r-cash account from the native REV vault.
   *
   * This is not an `RprintApi` method. The deploy is value-moving and has no contract op id;
   * an ambiguous submit must be rechecked by deploy id, never re-signed.
   */
  async fundNativeAccount(amount: number): Promise<Reply<{ ownerId: string }>> {
    const factory = this.config.rcashAccountFactoryUri ?? "";
    if (!factory) {
      throw new ConfigError(
        "r-cash account factory is not configured; import deployments/devnet.json or set it in Network settings",
      );
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ConfigError("deposit amount must be a positive integer");
    }
    return this.write(
      "fundNativeAccount",
      {
        op: "rcashDeposit",
        accountFactoryUri: factory,
        amount,
        opId: `deposit:${Date.now().toString(36)}`,
      },
      factory,
      (values) => ({ ownerId: str(values[0]) }),
    );
  }

  // --------------------------------------------------------------- writes

  async createPublication(input: CreatePublicationInput): Promise<Reply<{ uri: string }>> {
    const factory = await this.component("component:publication-factory");
    return this.write(
      "createPublication",
      {
        op: "createPublication",
        factoryUri: factory,
        opId: input.opId,
        publicationId: input.publicationId,
        charter: chainCharter(input.charter),
        members: input.members,
      },
      factory,
      (values) => ({ uri: str(values[0]) }),
    );
  }

  async addMember(uri: string, input: MemberInput): Promise<Reply<null>> {
    return this.write("addMember", {
      op: "addMember",
      publicationUri: uri,
      opId: input.opId,
      memberId: input.memberId,
      role: input.role ?? "",
      did: input.did ?? "",
      attestationHash: input.attestationHash ?? "",
    }, uri);
  }

  async removeMember(uri: string, input: MemberInput): Promise<Reply<null>> {
    return this.write("removeMember", {
      op: "removeMember",
      publicationUri: uri,
      opId: input.opId,
      memberId: input.memberId,
    }, uri);
  }

  async setRole(uri: string, input: MemberInput): Promise<Reply<null>> {
    return this.write("setRole", {
      op: "setRole",
      publicationUri: uri,
      opId: input.opId,
      memberId: input.memberId,
      role: input.role ?? "",
    }, uri);
  }

  async attestSelf(uri: string, input: MemberInput): Promise<Reply<null>> {
    return this.write("attestSelf", {
      op: "attestSelf",
      publicationUri: uri,
      opId: input.opId,
      did: input.did ?? "",
      attestationHash: input.attestationHash ?? "",
    }, uri);
  }

  async pausePublication(
    uri: string,
    input: { opId: string; paused: boolean },
  ): Promise<Reply<null>> {
    return this.write("pausePublication", {
      op: "pausePublication",
      publicationUri: uri,
      opId: input.opId,
      paused: input.paused,
    }, uri);
  }

  async publicationAdmin(uri: string, input: AdminInput): Promise<Reply<null>> {
    return this.write("publicationAdmin", {
      op: "publicationAdmin",
      publicationUri: uri,
      nonce: input.nonce,
      action: input.action,
      args: input.args,
      sigs: input.sigs,
    }, uri);
  }

  async attachCover(
    uri: string,
    input: { opId: string; coverUri: string },
  ): Promise<Reply<null>> {
    return this.write("attachCover", {
      op: "attachCover",
      proposalUri: uri,
      opId: input.opId,
      coverUri: input.coverUri,
    }, uri);
  }

  async proposeCommission(
    input: ProposeCommissionInput,
  ): Promise<Reply<{ uri: string }>> {
    const factory = await this.component("component:commission-factory");
    return this.write(
      "proposeCommission",
      {
        op: "proposeCommission",
        factoryUri: factory,
        opId: input.opId,
        proposalId: input.proposalId,
        data: {
          publicationId: input.publicationId,
          publicationUri: input.publicationUri,
          writerDid: input.writerDid,
          titleHash: input.titleHash,
          briefHash: input.briefHash,
          total: input.total,
          milestones: input.milestones,
          graceBlocks: input.graceBlocks,
          disputeWindowBlocks: input.disputeWindowBlocks,
          requireFactCheck: input.requireFactCheck,
          fundingSource: "funder",
        },
      },
      factory,
      (values) => ({ uri: str(values[0]) }),
    );
  }

  async acceptProposal(uri: string, input: { opId: string }): Promise<Reply<null>> {
    return this.write("acceptProposal", {
      op: "acceptProposal",
      proposalUri: uri,
      opId: input.opId,
    }, uri);
  }

  async fundProposal(
    uri: string,
    input: { opId: string },
  ): Promise<Reply<{ escrowUri: string }>> {
    return this.write(
      "fundProposal",
      { op: "fundProposal", proposalUri: uri, opId: input.opId },
      uri,
      (values) => ({ escrowUri: str(values[0]) }),
    );
  }

  async cancelProposal(uri: string, input: CancelProposalInput): Promise<Reply<null>> {
    return this.write("cancelProposal", {
      op: "cancelProposal",
      proposalUri: uri,
      opId: input.opId,
      reasonHash: input.reasonHash,
    }, uri);
  }

  async submitMilestone(
    escrowUri: string,
    input: MilestoneActionInput,
  ): Promise<Reply<null>> {
    return this.write("submitMilestone", {
      op: "submitMilestone",
      escrowUri,
      opId: input.opId,
      milestoneId: input.milestoneId,
      evidenceHash: input.evidenceHash ?? "",
    }, escrowUri);
  }

  async releaseMilestone(
    escrowUri: string,
    input: MilestoneActionInput,
  ): Promise<Reply<null>> {
    return this.write("releaseMilestone", {
      op: "releaseMilestone",
      escrowUri,
      opId: input.opId,
      milestoneId: input.milestoneId,
    }, escrowUri);
  }

  async cancelEscrow(
    escrowUri: string,
    input: { opId: string; reasonHash: string },
  ): Promise<Reply<null>> {
    return this.write("cancelEscrow", {
      op: "cancelEscrow",
      escrowUri,
      opId: input.opId,
      reasonHash: input.reasonHash,
    }, escrowUri);
  }

  async disputeEscrow(
    escrowUri: string,
    input: { opId: string; reasonHash: string },
  ): Promise<Reply<null>> {
    return this.write("disputeEscrow", {
      op: "disputeEscrow",
      escrowUri,
      opId: input.opId,
      reasonHash: input.reasonHash,
    }, escrowUri);
  }

  async arbitrateEscrow(
    escrowUri: string,
    input: ArbitrateInput,
  ): Promise<Reply<null>> {
    return this.write("arbitrateEscrow", {
      op: "arbitrateEscrow",
      escrowUri,
      nonce: input.nonce,
      writerBps: input.writerBps,
      sigs: input.sigs,
      opId: input.opId,
    }, escrowUri);
  }

  async expireEscrow(
    escrowUri: string,
    input: { opId: string },
  ): Promise<Reply<null>> {
    return this.write("expireEscrow", {
      op: "expireEscrow",
      escrowUri,
      opId: input.opId,
    }, escrowUri);
  }

  async resolveDispute(
    escrowUri: string,
    input: ResolveDisputeInput,
  ): Promise<Reply<null>> {
    return this.write("resolveDispute", {
      op: "resolveDispute",
      escrowUri,
      opId: input.opId,
    }, escrowUri);
  }

  async createArticle(input: CreateArticleInput): Promise<Reply<{ uri: string }>> {
    const factory = await this.component("component:article-factory");
    const { opId, articleId, ...data } = input;
    return this.write(
      "createArticle",
      { op: "createArticle", factoryUri: factory, opId, articleId, data },
      factory,
      (values) => ({ uri: str(values[0]) }),
    );
  }

  async submitArticle(
    uri: string,
    input: { opId: string; contentHash: string },
  ): Promise<Reply<null>> {
    return this.write("submitArticle", {
      op: "submitArticle",
      articleUri: uri,
      opId: input.opId,
      contentHash: input.contentHash,
    }, uri);
  }

  async attachKnowledge(uri: string, input: KnowledgeInput): Promise<Reply<null>> {
    return this.write("attachKnowledge", {
      op: "attachKnowledge",
      articleUri: uri,
      opId: input.opId,
      kassetUri: input.kassetUri,
      claimUri: input.claimUri,
      provenanceUri: input.provenanceUri,
      credentialUri: input.credentialUri,
    }, uri);
  }

  async attestArticle(uri: string, input: AttestInput): Promise<Reply<null>> {
    return this.write("attestArticle", {
      op: "attestArticle",
      articleUri: uri,
      opId: input.opId,
      attestationId: input.attestationId,
      kind: input.kind,
      evidenceHash: input.evidenceHash,
    }, uri);
  }

  async approveArticle(uri: string, input: { opId: string }): Promise<Reply<null>> {
    return this.write("approveArticle", {
      op: "approveArticle",
      articleUri: uri,
      opId: input.opId,
    }, uri);
  }

  async publishArticle(uri: string, input: { opId: string }): Promise<Reply<null>> {
    return this.write("publishArticle", {
      op: "publishArticle",
      articleUri: uri,
      opId: input.opId,
    }, uri);
  }

  async correctArticle(uri: string, input: CorrectionInput): Promise<Reply<null>> {
    return this.write("correctArticle", {
      op: "correctArticle",
      articleUri: uri,
      opId: input.opId,
      correctionId: input.correctionId,
      kind: input.kind,
      bodyHash: input.bodyHash,
      reasonHash: input.reasonHash,
    }, uri);
  }

  async retractArticle(
    uri: string,
    input: { opId: string; reasonHash: string },
  ): Promise<Reply<null>> {
    return this.write("retractArticle", {
      op: "retractArticle",
      articleUri: uri,
      opId: input.opId,
      reasonHash: input.reasonHash,
    }, uri);
  }

  async createEdition(input: CreateEditionInput): Promise<Reply<{ uri: string }>> {
    const factory = await this.component("component:edition-factory");
    return this.write(
      "createEdition",
      {
        op: "createEdition",
        factoryUri: factory,
        opId: input.opId,
        editionId: input.editionId,
        data: {
          publicationId: input.publicationId,
          publicationUri: input.publicationUri,
          number: input.number,
          titleHash: input.titleHash,
          coverHash: input.coverHash,
        },
      },
      factory,
      (values) => ({ uri: str(values[0]) }),
    );
  }

  async appendEditionArticle(
    uri: string,
    input: { opId: string; articleUri: string },
  ): Promise<Reply<null>> {
    return this.write("appendEditionArticle", {
      op: "appendEditionArticle",
      editionUri: uri,
      opId: input.opId,
      articleUri: input.articleUri,
    }, uri);
  }

  async sealEdition(uri: string, input: SealEditionInput): Promise<Reply<null>> {
    return this.write("sealEdition", {
      op: "sealEdition",
      editionUri: uri,
      opId: input.opId,
      editorSig: input.editorSig,
    }, uri);
  }

  async keystoreCreate(input: KeystoreInput): Promise<Reply<KeystoreResult>> {
    const info = this.bridge.createWallet(input.password);
    return {
      ok: true,
      value: { address: info.address, document: info.document ?? "" },
    };
  }

  async keystoreUnlock(
    input: KeystoreInput & { document: string },
  ): Promise<Reply<KeystoreResult>> {
    const info = this.bridge.unlockWallet(input.document, input.password);
    return { ok: true, value: { address: info.address, document: input.document } };
  }

  // ------------------------------------------------------------- internals

  private extras(): LiveExtras {
    return new LiveExtras(this.bridge, this.transport, (key) =>
      this.resolveComponent(key),
    );
  }

  private async component(key: string): Promise<string> {
    const cached = this.components.get(key);
    if (cached) return cached;
    const reply = await this.resolveComponent(key);
    if (!reply.ok) {
      throw new ConfigError(
        `cannot resolve ${key} (${reply.reason}); check the root URI in Network settings`,
      );
    }
    return reply.value.uri;
  }

  private async readReply(uri: string, binding: string): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
    const reply = await this.readAll(uri, binding);
    if (!reply.ok) return reply;
    return { ok: true, value: reply.values[0] ?? null };
  }

  private async readAll(
    uri: string,
    binding: string,
    args?: unknown[],
  ): Promise<ReadResult> {
    const term = this.bridge.buildTerm({
      op: "read",
      uri,
      binding,
      args: args && args.length ? args : null,
    });
    const result = await this.transport.explore(term);
    if (!result.expr.length) {
      throw new DecodeError(
        `no reply from ${binding}; replySource=${result.replySource || "none"}`,
      );
    }
    const decoded = this.bridge.decodeReply(result.expr[0]);
    if (!decoded.ok) return { ok: false, reason: decoded.reason ?? "refused" };
    return { ok: true, values: decoded.values ?? [] };
  }

  private async write<T>(
    method: string,
    request: unknown,
    target: string,
    map?: (values: unknown[]) => T,
  ): Promise<Reply<T>> {
    if (!this.bridge.isUnlocked()) throw new WalletLockedError(method);
    const requestRecord = asRecord(request);
    const opId = typeof requestRecord.opId === "string" ? requestRecord.opId : undefined;
    const logId = this.log.begin({ method, target, opId });
    try {
      const term = this.bridge.buildTerm(request);
      const tip = await this.transport.height();
      const options: SignOptions = {
        validAfter: tip,
        phloLimit: this.config.phloLimit,
        phloPrice: this.config.phloPrice,
        shard: this.config.shardId,
      };
      const signed = this.bridge.signDeploy(term, options);
      this.log.update(logId, { deployId: signed.deployId });
      await this.transport.submit(signed.body);
      const status = await waitProcessed(
        this.transport,
        signed.deployId,
        this.config.processedTimeoutMs,
      );
      if ("ProcessedWithError" in status) {
        const failure = new DeployFailed(
          status.ProcessedWithError.deployError,
          status.ProcessedWithError.block,
        );
        this.log.update(logId, {
          status: "failed",
          blockHash: status.ProcessedWithError.block.blockHash,
          blockNumber: status.ProcessedWithError.block.blockNumber,
          error: failure.message,
        });
        throw failure;
      }
      if ("NotProcessed" in status) {
        throw new ProcessedTimeout(signed.deployId, status.NotProcessed.status);
      }
      const success = status.ProcessedWithSuccess;
      this.log.update(logId, {
        blockHash: success.block.blockHash,
        blockNumber: success.block.blockNumber,
      });
      await waitFinalized(
        this.transport,
        signed.deployId,
        success.block.blockHash,
        this.config.finalityTimeoutMs,
      );
      const decoded: DecodedReply = success.deployResult.length
        ? this.bridge.decodeReply(success.deployResult[0])
        : { ok: true, values: [] };
      if (!decoded.ok) {
        this.log.update(logId, {
          status: "refused",
          reason: decoded.reason ?? "refused",
        });
        return { ok: false, reason: decoded.reason ?? "refused" };
      }
      const values = decoded.values ?? [];
      const value = map ? map(values) : (null as T);
      this.log.update(logId, {
        status: "finalized",
        reply: values,
      });
      return { ok: true, value };
    } catch (error) {
      this.log.update(logId, {
        status: error instanceof DeployFailed ? "failed" : "pending",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// ------------------------------------------------------------- mappers

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord)
    : [];
}

/** The chain stores admin/arbitrator keys as byte arrays, not hex strings. */
function chainCharter(value: Charter): unknown {
  return {
    ...value,
    admins: value.admins.map(bytesValue),
    governance: {
      ...value.governance,
      arbitrators: (value.governance.arbitrators ?? []).map(bytesValue),
    },
  };
}

function networkStatus(status: NodeStatus, node: string): NetworkStatus {
  return {
    node,
    networkId: str(status.networkId),
    shardId: str(status.shardId),
    latestBlockNumber: num(status.latestBlockNumber),
    acceptsDeploys: bool(
      status.acceptsDeploys,
      bool(status.autopropose) || bool(status.proposeOnDeploy) || bool(status.manualPropose),
    ),
    degraded: str(status.degraded),
  };
}

function charter(raw: unknown): Charter {
  const value = asRecord(raw);
  const governance = asRecord(value.governance);
  return {
    nameHash: str(value.nameHash),
    mastheadHash: str(value.mastheadHash),
    taglineHash: str(value.taglineHash),
    foundedAtHeight: num(value.foundedAtHeight),
    treasuryAccountId: str(value.treasuryAccountId),
    assetId: "REV",
    revenueSplit: records(value.revenueSplit).map((split) => ({
      memberId: str(split.memberId),
      bps: num(split.bps),
    })),
    admins: strings(value.admins),
    threshold: num(value.threshold),
    governance: {
      maxMembers: num(governance.maxMembers, 32),
      requireFactCheck: bool(governance.requireFactCheck),
      requireKAsset: bool(governance.requireKAsset),
      disputeWindowBlocks: num(governance.disputeWindowBlocks),
      commissionGraceBlocks: num(governance.commissionGraceBlocks),
      arbitrators: strings(governance.arbitrators),
      arbitrationThreshold: num(governance.arbitrationThreshold),
    },
  };
}

function members(raw: unknown): Record<string, Member> {
  const value = asRecord(raw);
  const out: Record<string, Member> = {};
  for (const [key, item] of Object.entries(value)) {
    const member = asRecord(item);
    out[key] = {
      role: str(member.role, "contributor") as Member["role"],
      did: str(member.did),
      attestationHash: str(member.attestationHash),
      status: str(member.status, "active") === "removed" ? "removed" : "active",
      sinceHeight: num(member.sinceHeight),
    };
  }
  return out;
}

function publicationInfo(raw: unknown): PublicationState {
  const value = asRecord(raw);
  const coverUri = str(value.coverUri);
  const coverStatus = str(value.coverStatus);
  return {
    publicationId: str(value.publicationId),
    charterHash: str(value.charterHash),
    status: str(value.status, "active") as PublicationState["status"],
    admins: strings(value.admins),
    threshold: num(value.threshold),
    nonce: num(value.nonce),
    charter: charter(value.charter),
    members: members(value.members),
    ...(coverUri ? { coverUri } : {}),
    ...(coverStatus ? { coverStatus } : {}),
  };
}

function milestones(raw: unknown, defaultStatus: Milestone["status"]): Milestone[] {
  return records(raw).map((item) => {
    const evidence = str(item.evidenceHash);
    const submitted = num(item.submittedAtHeight);
    const released = num(item.releasedAtHeight);
    return {
      id: str(item.id),
      kind: str(item.kind, "stipend") as Milestone["kind"],
      amount: num(item.amount),
      deadlineHeight: num(item.deadlineHeight),
      status: str(item.status, defaultStatus) as Milestone["status"],
      ...(evidence ? { evidenceHash: evidence } : {}),
      ...(submitted ? { submittedAtHeight: submitted } : {}),
      ...(released ? { releasedAtHeight: released } : {}),
    };
  });
}

function proposal(raw: unknown): ProposalState {
  const value = asRecord(raw);
  const coverUri = str(value.coverUri);
  const coverStatus = str(value.coverStatus);
  return {
    proposalId: str(value.proposalId),
    publicationId: str(value.publicationId),
    publicationUri: str(value.publicationUri),
    writerId: str(value.writerId),
    writerDid: str(value.writerDid),
    editorId: str(value.editorId),
    titleHash: str(value.titleHash),
    briefHash: str(value.briefHash),
    total: num(value.total),
    milestones: milestones(value.milestones, "pending"),
    graceBlocks: num(value.graceBlocks),
    disputeWindowBlocks: num(value.disputeWindowBlocks),
    requireFactCheck: bool(value.requireFactCheck),
    status: str(value.status, "proposed") as ProposalState["status"],
    escrowUri: str(value.escrowUri),
    createdAtHeight: num(value.createdAtHeight),
    ...(coverUri ? { coverUri } : {}),
    ...(coverStatus ? { coverStatus } : {}),
  };
}

function escrow(raw: unknown): EscrowState {
  const value = asRecord(raw);
  const dispute = asRecord(value.dispute);
  const coverUri = str(value.coverUri);
  return {
    escrowId: str(value.escrowId),
    proposalId: str(value.proposalId),
    publicationId: str(value.publicationId),
    publicationUri: str(value.publicationUri),
    writerId: str(value.writerId),
    writerDid: str(value.writerDid),
    editorId: str(value.editorId),
    funderId: str(value.funderId),
    assetId: "REV",
    purseUri: str(value.purseUri),
    total: num(value.total),
    milestones: milestones(value.milestones, "pending"),
    graceBlocks: num(value.graceBlocks),
    disputeWindowBlocks: num(value.disputeWindowBlocks),
    hardDeadlineHeight: num(value.hardDeadlineHeight),
    paidWriter: num(value.paidWriter),
    refundedFunder: num(value.refundedFunder),
    fee: num(value.fee),
    status: str(value.status, "active") as EscrowState["status"],
    dispute: {
      by: str(dispute.by),
      reasonHash: str(dispute.reasonHash),
      atHeight: num(dispute.atHeight),
    },
    nonce: num(value.nonce),
    ...(coverUri ? { coverUri } : {}),
  };
}

function article(raw: unknown): ArticleState {
  const value = asRecord(raw);
  return {
    articleId: str(value.articleId),
    publicationId: str(value.publicationId),
    publicationUri: str(value.publicationUri),
    authors: records(value.authors).map((author) => ({
      memberId: str(author.memberId),
      did: str(author.did),
      bylineHash: str(author.bylineHash),
    })),
    contentHash: str(value.contentHash),
    license: str(value.license),
    customLicenseHash: str(value.customLicenseHash),
    access: str(value.access, "open") as ArticleState["access"],
    sectionHash: str(value.sectionHash),
    requireFactCheck: bool(value.requireFactCheck),
    requireKAsset: bool(value.requireKAsset),
    kassetUri: str(value.kassetUri),
    claimUri: str(value.claimUri),
    provenanceUri: str(value.provenanceUri),
    credentialUri: str(value.credentialUri),
    knowledgeAtHeight: num(value.knowledgeAtHeight),
    status: str(value.status, "draft") as ArticleState["status"],
    publishHeight: num(value.publishHeight),
    retractHeight: num(value.retractHeight),
    attestations: records(value.attestations).map(
      (item): Attestation => ({
        id: str(item.id),
        kind: str(item.kind, "editor") as Attestation["kind"],
        by: str(item.by),
        evidenceHash: str(item.evidenceHash),
      }),
    ),
    corrections: records(value.corrections).map(
      (item): Correction => ({
        id: str(item.id),
        kind: str(item.kind, "correction") as Correction["kind"],
        bodyHash: str(item.bodyHash),
        reasonHash: str(item.reasonHash),
        articleHash: str(item.articleHash),
        by: str(item.by),
      }),
    ),
    createdAtHeight: num(value.createdAtHeight),
  };
}

function edition(raw: unknown): EditionState {
  const value = asRecord(raw);
  const seal = asRecord(value.seal);
  return {
    editionId: str(value.editionId),
    publicationId: str(value.publicationId),
    publicationUri: str(value.publicationUri),
    number: num(value.number),
    titleHash: str(value.titleHash),
    coverHash: str(value.coverHash),
    articles: records(value.articles).map((item): EditionEntry => {
      const kassetUri = str(item.kassetUri);
      return {
        articleId: str(item.articleId),
        articleUri: str(item.articleUri),
        contentHash: str(item.contentHash),
        ...(kassetUri ? { kassetUri } : {}),
      };
    }),
    status: str(value.status, "draft") as EditionState["status"],
    seal: {
      manifestHash: str(seal.manifestHash),
      editorId: str(seal.editorId),
      editorSig: str(seal.editorSig),
      sealedAtHeight: num(seal.sealedAtHeight),
    },
    createdAtHeight: num(value.createdAtHeight),
  };
}

function coordination(raw: unknown): CoordinationState {
  const value = asRecord(raw);
  const subject = asRecord(value.subjectRef);
  return {
    coordinationId: str(value.coordinationId),
    publicationId: str(value.publicationId),
    publicationUri: str(value.publicationUri),
    subjectRef: {
      kind: str(subject.kind),
      id: str(subject.id),
      uri: str(subject.uri),
    },
    roomIdHash: str(value.roomIdHash),
    pollIdHash: str(value.pollIdHash),
    outcomeHash: str(value.outcomeHash),
    signers: strings(value.signers),
    signatures: records(value.signatures).map((item) => ({
      by: str(item.by),
      sig: str(item.sig),
      atHeight: num(item.atHeight),
    })),
    status: str(value.status, "open") as CoordinationState["status"],
    createdBy: str(value.createdBy),
    createdAtHeight: num(value.createdAtHeight),
    recordedAtHeight: num(value.recordedAtHeight),
  };
}
