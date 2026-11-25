/**
 * State and reply shapes mirrored from the r-print Rholang cells.
 *
 * These are deliberately loose where the chain is loose: the contracts store hashes and
 * references as strings, and readers must not assume the content exists. Monetary amounts
 * are integer minor units. Heights are block heights, never timestamps.
 */

export type Reply<T> = { ok: true; value: T } | { ok: false; reason: string };

export type Role =
  | "publisher"
  | "editor"
  | "writer"
  | "factchecker"
  | "treasurer"
  | "contributor";

export type PublicationStatus = "active" | "paused" | "closed";
export type ProposalStatus = "proposed" | "accepted" | "funded" | "cancelled";
export type EscrowStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "disputed"
  | "arbitrated"
  | "expired";
export type MilestoneStatus = "pending" | "submitted" | "released" | "refunded" | "arbitrated";
export type ArticleStatus = "draft" | "submitted" | "approved" | "published" | "retracted";
export type EditionStatus = "draft" | "sealed";

export interface Member {
  role: Role;
  did: string;
  attestationHash: string;
  status: "active" | "removed";
  sinceHeight: number;
}

export interface RevenueSplit {
  memberId: string;
  bps: number;
}

export interface Governance {
  maxMembers: number;
  requireFactCheck: boolean;
  requireKAsset?: boolean;
  disputeWindowBlocks: number;
  commissionGraceBlocks: number;
  arbitrators?: string[];
  arbitrationThreshold?: number;
}

export interface Charter {
  nameHash: string;
  mastheadHash: string;
  taglineHash: string;
  foundedAtHeight: number;
  treasuryAccountId: string;
  assetId: "REV";
  revenueSplit: RevenueSplit[];
  admins: string[];
  threshold: number;
  governance: Governance;
}

export interface PublicationState {
  publicationId: string;
  charterHash: string;
  status: PublicationStatus;
  admins: string[];
  threshold: number;
  nonce: number;
  charter: Charter;
  members: Record<string, Member>;
  coverUri?: string;
  coverStatus?: string;
}

export interface Milestone {
  id: string;
  kind: "stipend" | "draft" | "final" | "expense" | "bonus";
  amount: number;
  deadlineHeight: number;
  status: MilestoneStatus;
  evidenceHash?: string;
  submittedAtHeight?: number;
  releasedAtHeight?: number;
}

export interface ProposalState {
  proposalId: string;
  publicationId: string;
  publicationUri: string;
  writerId: string;
  writerDid: string;
  editorId: string;
  titleHash: string;
  briefHash: string;
  total: number;
  milestones: Milestone[];
  graceBlocks: number;
  disputeWindowBlocks: number;
  requireFactCheck: boolean;
  coverUri?: string;
  coverStatus?: string;
  coverAssetId?: string;
  coverPerClaimLimit?: number;
  coverAggregateRemaining?: number;
  coverInsured?: string;
  status: ProposalStatus;
  escrowUri: string;
  createdAtHeight: number;
}

export interface EscrowState {
  escrowId: string;
  proposalId: string;
  publicationId: string;
  publicationUri: string;
  writerId: string;
  writerDid: string;
  editorId: string;
  funderId: string;
  assetId: "REV";
  purseUri: string;
  coverUri?: string;
  total: number;
  milestones: Milestone[];
  graceBlocks: number;
  disputeWindowBlocks: number;
  hardDeadlineHeight: number;
  paidWriter: number;
  refundedFunder: number;
  fee: number;
  status: EscrowStatus;
  dispute: { by: string; reasonHash: string; atHeight: number };
  nonce: number;
}

export interface AuthorRef {
  memberId: string;
  did: string;
  bylineHash: string;
}

export interface Attestation {
  id: string;
  kind: "factcheck" | "legal" | "editor";
  by: string;
  evidenceHash: string;
}

export interface Correction {
  id: string;
  kind: "correction" | "clarification" | "retraction";
  bodyHash: string;
  reasonHash: string;
  articleHash: string;
  by: string;
}

export interface ArticleState {
  articleId: string;
  publicationId: string;
  publicationUri: string;
  authors: AuthorRef[];
  contentHash: string;
  license: string;
  customLicenseHash: string;
  access: "open" | "members" | "embargoed";
  sectionHash: string;
  requireFactCheck: boolean;
  requireKAsset: boolean;
  kassetUri: string;
  claimUri: string;
  provenanceUri: string;
  credentialUri: string;
  knowledgeAtHeight: number;
  status: ArticleStatus;
  publishHeight: number;
  retractHeight: number;
  attestations: Attestation[];
  corrections: Correction[];
  createdAtHeight: number;
}

export interface EditionEntry {
  articleId: string;
  articleUri: string;
  contentHash: string;
  kassetUri?: string;
}

export interface EditionState {
  editionId: string;
  publicationId: string;
  publicationUri: string;
  number: number;
  titleHash: string;
  coverHash: string;
  articles: EditionEntry[];
  status: EditionStatus;
  seal: {
    manifestHash: string;
    editorId: string;
    editorSig: string;
    sealedAtHeight: number;
  };
  createdAtHeight: number;
}

export interface CoordinationState {
  coordinationId: string;
  publicationId: string;
  publicationUri: string;
  subjectRef: { kind: string; id: string; uri: string };
  roomIdHash: string;
  pollIdHash: string;
  outcomeHash: string;
  signers: string[];
  signatures: { by: string; sig: string; atHeight: number }[];
  status: "open" | "recorded";
  createdBy: string;
  createdAtHeight: number;
  recordedAtHeight: number;
}

export interface CoordinationSigner {
  memberId: string;
  pubKey: string;
  sig: string;
}

export interface CreateCoordinationInput {
  opId: string;
  coordinationId: string;
  publicationId: string;
  publicationUri: string;
  subjectKind: string;
  subjectId: string;
  subjectUri: string;
  roomIdHash: string;
  signerIds: string[];
}

export interface RecordCoordinationInput {
  opId: string;
  coordinationId: string;
  pollIdHash: string;
  outcomeHash: string;
  signatures: CoordinationSigner[];
}

export interface ResolveResult {
  component: string;
  uri: string;
  version: number;
}

export interface NetworkStatus {
  node: string;
  networkId: string;
  shardId: string;
  latestBlockNumber: number;
  acceptsDeploys: boolean;
  degraded: string;
}

export interface CatalogueEntry {
  id: string;
  title: string;
  uri: string;
  kind: "publication" | "article" | "edition" | "commission";
}

export interface KeystoreResult {
  address: string;
  document: string;
}

export interface CreatePublicationInput {
  publicationId: string;
  opId: string;
  charter: Charter;
  members: Array<{ memberId: string; role: Role; did: string; attestationHash: string }>;
}

export interface MemberInput {
  opId: string;
  memberId: string;
  role?: Role;
  did?: string;
  attestationHash?: string;
}

export interface AdminInput {
  nonce: number;
  action: "pause" | "resume" | "setAdmins" | "setThreshold" | "setTreasury";
  args: unknown[];
  sigs: string[];
}

export interface ProposeCommissionInput {
  proposalId: string;
  opId: string;
  publicationId: string;
  publicationUri: string;
  writerDid: string;
  titleHash: string;
  briefHash: string;
  total: number;
  milestones: Array<{ id: string; kind: Milestone["kind"]; amount: number; deadlineHeight: number }>;
  graceBlocks: number;
  disputeWindowBlocks: number;
  requireFactCheck: boolean;
}

export interface MilestoneActionInput {
  opId: string;
  milestoneId: string;
  evidenceHash?: string;
}

export interface ArbitrateInput {
  nonce: number;
  writerBps: number;
  sigs: string[];
  opId: string;
}

export interface CreateArticleInput {
  articleId: string;
  opId: string;
  publicationId: string;
  publicationUri: string;
  authors: AuthorRef[];
  contentHash: string;
  license: string;
  customLicenseHash: string;
  access: ArticleState["access"];
  sectionHash: string;
  requireFactCheck: boolean;
  requireKAsset: boolean;
}

export interface KnowledgeInput {
  opId: string;
  kassetUri: string;
  claimUri: string;
  provenanceUri: string;
  credentialUri: string;
}

export interface AttestInput {
  opId: string;
  attestationId: string;
  kind: Attestation["kind"];
  evidenceHash: string;
}

export interface CorrectionInput {
  opId: string;
  correctionId: string;
  kind: Correction["kind"];
  bodyHash: string;
  reasonHash: string;
}

export interface CreateEditionInput {
  editionId: string;
  opId: string;
  publicationId: string;
  publicationUri: string;
  number: number;
  titleHash: string;
  coverHash: string;
}

export interface SealEditionInput {
  opId: string;
  editorSig: string;
}

export interface KeystoreInput {
  password: string;
  name?: string;
}

export interface CancelProposalInput {
  opId: string;
  reasonHash: string;
}

export interface ResolveDisputeInput {
  opId: string;
}

/** The effective arbitration quorum from `Publication("arbitration")`. */
export interface ArbitrationAuthority {
  kind: "publication" | "platform";
  keys: string[];
  threshold: number;
}

/** Live client configuration, independent of React. */
export interface LiveConfig {
  nodeUrl: string;
  rootUri: string;
  shardId: string;
  phloLimit: number;
  phloPrice: number;
  processedTimeoutMs: number;
  finalityTimeoutMs: number;
  componentUris?: Record<string, string>;
  /** The pinned r-cash account factory for the live native-vault top-up. */
  rcashAccountFactoryUri?: string;
}

/**
 * The live-only funding helper. It is deliberately not part of `RprintApi`: the deposit is
 * an r-cash precharge rail, not an r-print contract arm.
 */
export interface AccountFunding {
  fundNativeAccount(amount: number): Promise<Reply<{ ownerId: string }>>;
}

export function isAccountFunding(value: unknown): value is AccountFunding {
  return (
    typeof (value as Partial<AccountFunding> | null | undefined)?.fundNativeAccount ===
    "function"
  );
}
