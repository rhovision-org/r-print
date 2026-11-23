/**
 * The complete v0.1 r-print client surface.
 *
 * Every method maps to one deployed Rholang arm. The default implementation is the
 * fixture-backed reader; write methods are specified here and stubbed in
 * `stub-api.ts` for a later WASM/live implementation. A method returns the chain's
 * `(true, value)` / `(false, reason)` shape as `Reply<T>`.
 *
 * Refusal strings follow `docs/reference/status-vocabulary.md`; the most common are
 * `status`, `role`, `duplicate`, `publication`, `not writer`, `not submitted`,
 * `milestone`, `too early`, `too late`, `paused`, `disabled` and `signature`.
 */
import type {
  AdminInput,
  ArbitrationAuthority,
  ArbitrateInput,
  ArticleState,
  AttestInput,
  CancelProposalInput,
  CatalogueEntry,
  Charter,
  CoordinationState,
  CorrectionInput,
  CreateArticleInput,
  CreateEditionInput,
  CreatePublicationInput,
  EditionState,
  EscrowState,
  KeystoreInput,
  KeystoreResult,
  KnowledgeInput,
  Member,
  MemberInput,
  MilestoneActionInput,
  NetworkStatus,
  ProposeCommissionInput,
  ProposalState,
  PublicationState,
  Reply,
  ResolveDisputeInput,
  ResolveResult,
  SealEditionInput,
} from "./types";

export interface RprintApi {
  /** Root directory: `PrintRoot("resolve", key, 1)`. Reply `(true, {uri, version})` or `(false, "unknown component"|"stale"|"retired")`. */
  resolveComponent(key: string): Promise<Reply<ResolveResult>>;

  /** Node read: `/api/v1/status`. Reply `(true, network)` or `(false, reason)`. */
  networkStatus(): Promise<Reply<NetworkStatus>>;

  /** `PublicationFactory("create", dId, opId, publicationId, charter, members)`. Reply `(true, uri)`; refuses `publication`, `terms`, `member`, `role`, `duplicate`, `not owner`. */
  createPublication(input: CreatePublicationInput): Promise<Reply<{ uri: string }>>;
  /** `Publication("info")`. Reply `(true, publicationState)`. */
  publicationInfo(uri: string): Promise<Reply<PublicationState>>;
  /** `Publication("charter")`. Reply `(true, charter)`. */
  publicationCharter(uri: string): Promise<Reply<Charter>>;
  /** `Publication("members")`. Reply `(true, {revAddress: member})`. */
  publicationMembers(uri: string): Promise<Reply<Record<string, Member>>>;
  /** `Publication("arbitration")`. Reply `(true, kind, keys, threshold)`; `kind` is `publication` or the platform fallback. */
  publicationArbitration(uri: string): Promise<Reply<ArbitrationAuthority>>;
  /** `Publication("addMember", dId, opId, memberId, role, did, attestationHash)`. Reply `(true, Nil)`; refuses `paused`, `role`, `duplicate`, `members`, `member`. */
  addMember(uri: string, input: MemberInput): Promise<Reply<null>>;
  /** `Publication("removeMember", dId, opId, memberId)`. Reply `(true, Nil)`; refuses `role`, `unknown member`, `last publisher`. */
  removeMember(uri: string, input: MemberInput): Promise<Reply<null>>;
  /** `Publication("setRole", dId, opId, memberId, role)`. Reply `(true, Nil)`; refuses `role`, `unknown member`, `last publisher`. */
  setRole(uri: string, input: MemberInput): Promise<Reply<null>>;
  /** `Publication("attestSelf", dId, opId, did, attestationHash)`. Reply `(true, Nil)`; refuses `not member`. */
  attestSelf(uri: string, input: MemberInput): Promise<Reply<null>>;
  /** `Publication("pause", dId, opId, paused)`. Reply `(true, Nil)`; refuses `role`. */
  pausePublication(uri: string, input: { opId: string; paused: boolean }): Promise<Reply<null>>;
  /** `Publication("admin", nonce, action, args, sigs)`. Reply `(true, Nil)`; refuses `replay`, `below threshold`, `threshold`, `unknown action`. */
  publicationAdmin(uri: string, input: AdminInput): Promise<Reply<null>>;
  /** `CommissionProposal("attachCover", dId, opId, coverUri)`, verified through `RsureAdapter("policy")`. Reply `(true, Nil)`; refuses `status`, `role`, `disabled`, `rsure adapter`. */
  attachCover(uri: string, input: { opId: string; coverUri: string }): Promise<Reply<null>>;

  /** `CommissionFactory("propose", dId, opId, proposalId, data)`. Reply `(true, proposalUri)`; refuses `total`, `milestone`, `publication`, `paused`, `duplicate`. */
  proposeCommission(input: ProposeCommissionInput): Promise<Reply<{ uri: string }>>;
  /** `CommissionProposal("info")`. Reply `(true, proposalState)`. */
  commissionProposalInfo(uri: string): Promise<Reply<ProposalState>>;
  /** `CommissionProposal("accept", dId, opId)`. Reply `(true, Nil)`; refuses `status`, `role`. */
  acceptProposal(uri: string, input: { opId: string }): Promise<Reply<null>>;
  /** `CommissionProposal("fund", dId, opId)`. Reply `(true, escrowUri)`; refuses `status`, `editor`, `proposal`. */
  fundProposal(uri: string, input: { opId: string }): Promise<Reply<{ escrowUri: string }>>;
  /** `CommissionProposal("cancel", dId, opId, reasonHash)`. Reply `(true, Nil)`; refuses `status`, `role`. */
  cancelProposal(uri: string, input: CancelProposalInput): Promise<Reply<null>>;
  /** `CommissionEscrow("submit", dId, opId, milestoneId, evidenceHash)`. Reply `(true, Nil)`; refuses `not writer`, `status`, `milestone`, `too late`. */
  submitMilestone(escrowUri: string, input: MilestoneActionInput): Promise<Reply<null>>;
  /** `CommissionEscrow("release", dId, opId, milestoneId)`. Reply `(true, Nil)`; refuses `status`, `role`, `not submitted`, `milestone`. */
  releaseMilestone(escrowUri: string, input: MilestoneActionInput): Promise<Reply<null>>;
  /** `CommissionEscrow("cancel", dId, opId, reasonHash)`. Reply `(true, Nil)`; refuses `status`, `role`, `closed`. */
  cancelEscrow(escrowUri: string, input: { opId: string; reasonHash: string }): Promise<Reply<null>>;
  /** `CommissionEscrow("dispute", dId, opId, reasonHash)`. Reply `(true, Nil)`; refuses `status`, `role`. */
  disputeEscrow(escrowUri: string, input: { opId: string; reasonHash: string }): Promise<Reply<null>>;
  /** `CommissionEscrow("arbitrate", nonce, writerBps, sigs, opId)`. Reply `(true, Nil)`; refuses `status`, `replay`, `bps`, `below threshold`. */
  arbitrateEscrow(escrowUri: string, input: ArbitrateInput): Promise<Reply<null>>;
  /** `CommissionEscrow("expire", opId)`. Reply `(true, Nil)`; refuses `status`, `too early`. */
  expireEscrow(escrowUri: string, input: { opId: string }): Promise<Reply<null>>;
  /** `CommissionEscrow("resolveDispute", opId)`. Permissionless after the dispute window; reply `(true, Nil)` or `(false, "too early"|"status")`. */
  resolveDispute(escrowUri: string, input: ResolveDisputeInput): Promise<Reply<null>>;
  /** `CommissionEscrow("info")`. Reply `(true, escrowState)`. */
  escrowInfo(uri: string): Promise<Reply<EscrowState>>;

  /** `ArticleFactory("create", dId, opId, articleId, data)`. Reply `(true, articleUri)`; refuses `content`, `license`, `access`, `author`, `publication`, `paused`, `duplicate`. */
  createArticle(input: CreateArticleInput): Promise<Reply<{ uri: string }>>;
  /** `Article("submit", dId, opId, contentHash)`. Reply `(true, Nil)`; refuses `not author`, `status`. */
  submitArticle(uri: string, input: { opId: string; contentHash: string }): Promise<Reply<null>>;
  /** `Article("attachKnowledge", dId, opId, kassetUri, claimUri, provenanceUri, credentialUri)`. Reply `(true, Nil)`; refuses `status`, `role`, `kasset`, `claim`, `provenance`. */
  attachKnowledge(uri: string, input: KnowledgeInput): Promise<Reply<null>>;
  /** `Article("attest", dId, opId, attestationId, kind, evidenceHash)`. Reply `(true, Nil)`; refuses `status`, `role`, `attestations`. */
  attestArticle(uri: string, input: AttestInput): Promise<Reply<null>>;
  /** `Article("approve", dId, opId)`. Reply `(true, Nil)`; refuses `status`, `role`, `kasset`. */
  approveArticle(uri: string, input: { opId: string }): Promise<Reply<null>>;
  /** `Article("publish", dId, opId)`. Reply `(true, Nil)`; refuses `status`, `role`. */
  publishArticle(uri: string, input: { opId: string }): Promise<Reply<null>>;
  /** `Article("correct", dId, opId, correctionId, kind, bodyHash, reasonHash)`. Reply `(true, Nil)`; refuses `status`, `role`, `corrections`. */
  correctArticle(uri: string, input: CorrectionInput): Promise<Reply<null>>;
  /** `Article("retract", dId, opId, reasonHash)`. Reply `(true, Nil)`; refuses `status`, `role`. */
  retractArticle(uri: string, input: { opId: string; reasonHash: string }): Promise<Reply<null>>;
  /** `Article("info")`. Reply `(true, articleState)`. */
  articleInfo(uri: string): Promise<Reply<ArticleState>>;

  /** `EditionFactory("create", dId, opId, editionId, data)`. Reply `(true, editionUri)`; refuses `edition`, `publication`, `role`, `terms`. */
  createEdition(input: CreateEditionInput): Promise<Reply<{ uri: string }>>;
  /** `Edition("append", dId, opId, articleUri)`. Reply `(true, Nil)`; refuses `status`, `role`, `edition full`, `article`, `publication`, `duplicate`. */
  appendEditionArticle(uri: string, input: { opId: string; articleUri: string }): Promise<Reply<null>>;
  /** `Edition("seal", dId, opId, editorSig)`. Reply `(true, Nil)`; refuses `status`, `edition`, `role`, `signature`, `verifier`. */
  sealEdition(uri: string, input: SealEditionInput): Promise<Reply<null>>;
  /** `Edition("info")`. Reply `(true, editionState)`. */
  editionInfo(uri: string): Promise<Reply<EditionState>>;

  /** `CoordinationRecord("info")` (design surface). Reply `(true, coordinationState)`. */
  coordinationInfo(uri: string): Promise<Reply<CoordinationState>>;

  /** Encrypt a secret with the Web3 v3 keystore in `rprint-wasm`. Reply `(true, {address, document})`; the plaintext key never reaches JS. */
  keystoreCreate(input: KeystoreInput): Promise<Reply<KeystoreResult>>;
  /** Decrypt a Web3 v3 keystore in `rprint-wasm`. Reply `(true, {address, document})` or `(false, "wrong password or corrupt keystore")`. */
  keystoreUnlock(input: KeystoreInput & { document: string }): Promise<Reply<KeystoreResult>>;
}

/** Every method on {@link RprintApi}; the surface-coverage test keeps UI docs in step. */
export const API_METHODS = [
  "resolveComponent",
  "networkStatus",
  "createPublication",
  "publicationInfo",
  "publicationCharter",
  "publicationMembers",
  "publicationArbitration",
  "addMember",
  "removeMember",
  "setRole",
  "attestSelf",
  "pausePublication",
  "publicationAdmin",
  "attachCover",
  "proposeCommission",
  "commissionProposalInfo",
  "acceptProposal",
  "fundProposal",
  "cancelProposal",
  "submitMilestone",
  "releaseMilestone",
  "cancelEscrow",
  "disputeEscrow",
  "arbitrateEscrow",
  "expireEscrow",
  "resolveDispute",
  "escrowInfo",
  "createArticle",
  "submitArticle",
  "attachKnowledge",
  "attestArticle",
  "approveArticle",
  "publishArticle",
  "correctArticle",
  "retractArticle",
  "articleInfo",
  "createEdition",
  "appendEditionArticle",
  "sealEdition",
  "editionInfo",
  "coordinationInfo",
  "keystoreCreate",
  "keystoreUnlock",
] as const;

export type ApiMethod = (typeof API_METHODS)[number];

/** Read-only methods: explore-deploy, no wallet, no finality wait. */
export const READ_METHODS = [
  "resolveComponent",
  "networkStatus",
  "publicationInfo",
  "publicationCharter",
  "publicationMembers",
  "publicationArbitration",
  "commissionProposalInfo",
  "escrowInfo",
  "articleInfo",
  "editionInfo",
  "coordinationInfo",
] as const satisfies readonly ApiMethod[];

/** Value-moving or state-changing methods: signed deploy, processed + final. */
export const WRITE_METHODS = [
  "createPublication",
  "addMember",
  "removeMember",
  "setRole",
  "attestSelf",
  "pausePublication",
  "publicationAdmin",
  "attachCover",
  "proposeCommission",
  "acceptProposal",
  "fundProposal",
  "cancelProposal",
  "submitMilestone",
  "releaseMilestone",
  "cancelEscrow",
  "disputeEscrow",
  "arbitrateEscrow",
  "expireEscrow",
  "resolveDispute",
  "createArticle",
  "submitArticle",
  "attachKnowledge",
  "attestArticle",
  "approveArticle",
  "publishArticle",
  "correctArticle",
  "retractArticle",
  "createEdition",
  "appendEditionArticle",
  "sealEdition",
  "keystoreCreate",
  "keystoreUnlock",
] as const satisfies readonly ApiMethod[];

export type ReadMethod = (typeof READ_METHODS)[number];
export type WriteMethod = (typeof WRITE_METHODS)[number];

export type Catalogue = CatalogueEntry[];
