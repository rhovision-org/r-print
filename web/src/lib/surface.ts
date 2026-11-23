/**
 * The UI surface map. Each API method names the screen and route that documents it; the
 * surface-coverage test fails if a method has no entry.
 */
import type { ApiMethod } from "./api";

export interface SurfaceEntry {
  method: ApiMethod;
  screen: string;
  route: string;
  note: string;
}

export const SURFACE: SurfaceEntry[] = [
  { method: "resolveComponent", screen: "Network settings", route: "/network", note: "Resolve a component key from the root." },
  { method: "networkStatus", screen: "Network settings", route: "/network", note: "Node height and deploy readiness." },
  { method: "createPublication", screen: "Home / new publication", route: "/", note: "Found a masthead, charter and founding roster." },
  { method: "publicationInfo", screen: "Publication", route: "/publication/:uri", note: "Charter, status, cover and counters." },
  { method: "publicationCharter", screen: "Publication", route: "/publication/:uri", note: "Charter hashes, treasury and revenue split." },
  { method: "publicationMembers", screen: "Publication", route: "/publication/:uri", note: "Roster table." },
  { method: "publicationArbitration", screen: "Publication", route: "/publication/:uri", note: "Effective arbitration quorum, including the platform fallback." },
  { method: "addMember", screen: "Member editor", route: "/publication/:uri/members", note: "Invite a REV address with a role." },
  { method: "removeMember", screen: "Member editor", route: "/publication/:uri/members", note: "Mark a member removed; last publisher refused." },
  { method: "setRole", screen: "Member editor", route: "/publication/:uri/members", note: "Change a role; last publisher refused." },
  { method: "attestSelf", screen: "Member editor", route: "/publication/:uri/members", note: "Attach a DID/credential anchor to yourself." },
  { method: "pausePublication", screen: "Publication admin", route: "/publication/:uri", note: "Block new commissions and articles." },
  { method: "publicationAdmin", screen: "Publication admin", route: "/publication/:uri", note: "Multisig pause, admins, threshold, treasury." },
  { method: "attachCover", screen: "Commission proposal", route: "/commission/:uri", note: "Attach an r-sure policy as optional cover." },
  { method: "proposeCommission", screen: "Home / new commission", route: "/", note: "Pitch a commissioned work with milestones." },
  { method: "commissionProposalInfo", screen: "Commission proposal", route: "/commission/:uri", note: "Writer, editor, milestones and cover." },
  { method: "acceptProposal", screen: "Commission proposal", route: "/commission/:uri", note: "Editor accepts the pitch." },
  { method: "fundProposal", screen: "Commission proposal", route: "/commission/:uri", note: "Funder creates the escrow." },
  { method: "cancelProposal", screen: "Commission proposal", route: "/commission/:uri", note: "Cancel before funding." },
  { method: "submitMilestone", screen: "Commission escrow", route: "/escrow/:uri", note: "Writer submits evidence before the deadline." },
  { method: "releaseMilestone", screen: "Commission escrow", route: "/escrow/:uri", note: "Editor releases a submitted milestone." },
  { method: "cancelEscrow", screen: "Commission escrow", route: "/escrow/:uri", note: "Refund the remaining balance." },
  { method: "disputeEscrow", screen: "Commission escrow", route: "/escrow/:uri", note: "Freeze an active escrow." },
  { method: "arbitrateEscrow", screen: "Commission escrow", route: "/escrow/:uri", note: "Publication or platform quorum splits the remainder." },
  { method: "expireEscrow", screen: "Commission escrow", route: "/escrow/:uri", note: "Permissionless refund after the hard deadline." },
  { method: "resolveDispute", screen: "Commission escrow", route: "/escrow/:uri", note: "Permissionless conservative refund after the dispute window." },
  { method: "escrowInfo", screen: "Commission escrow", route: "/escrow/:uri", note: "Timeline, accounting and dispute state." },
  { method: "createArticle", screen: "Home / new article", route: "/", note: "Register an article against a publication." },
  { method: "submitArticle", screen: "Article", route: "/article/:uri", note: "Author submits a content hash." },
  { method: "attachKnowledge", screen: "Article", route: "/article/:uri", note: "Optional r-gen Claim/KAsset/Provenance links." },
  { method: "attestArticle", screen: "Article", route: "/article/:uri", note: "Fact-check, legal or editorial attestation." },
  { method: "approveArticle", screen: "Article", route: "/article/:uri", note: "Editorial approval; optional KAsset gate." },
  { method: "publishArticle", screen: "Article", route: "/article/:uri", note: "Publish an approved article." },
  { method: "correctArticle", screen: "Article", route: "/article/:uri", note: "Append a correction or clarification." },
  { method: "retractArticle", screen: "Article", route: "/article/:uri", note: "Retract a published article." },
  { method: "articleInfo", screen: "Article", route: "/article/:uri", note: "Provenance, reviews and corrections." },
  { method: "createEdition", screen: "Edition", route: "/edition/:uri", note: "Create an issue container." },
  { method: "appendEditionArticle", screen: "Edition", route: "/edition/:uri", note: "Append a published article." },
  { method: "sealEdition", screen: "Edition", route: "/edition/:uri", note: "Seal the ordered manifest with an editor signature." },
  { method: "editionInfo", screen: "Edition", route: "/edition/:uri", note: "Manifest, manifest hash and seal height." },
  { method: "coordinationInfo", screen: "Coordination record", route: "/coordination/:uri", note: "Quantum-os room/poll anchor." },
  { method: "keystoreCreate", screen: "Keystore", route: "/keystore", note: "Create an encrypted Web3 v3 keystore." },
  { method: "keystoreUnlock", screen: "Keystore", route: "/keystore", note: "Unlock a saved keystore in WASM." },
];

export function surfaceFor(method: ApiMethod): SurfaceEntry | undefined {
  return SURFACE.find((entry) => entry.method === method);
}
