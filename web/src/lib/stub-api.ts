/**
 * The v0.1 write surface as executable stubs.
 *
 * Every method rejects with {@link NotImplementedError}. The UI renders the action, the
 * expected inputs and the contract arm, so a later implementation only has to replace the
 * body with a WASM call; it does not have to invent the surface.
 */
import type {
  AdminInput,
  ArbitrateInput,
  AttestInput,
  CorrectionInput,
  CreateArticleInput,
  CreateEditionInput,
  CreatePublicationInput,
  KeystoreInput,
  KeystoreResult,
  KnowledgeInput,
  MemberInput,
  MilestoneActionInput,
  ProposeCommissionInput,
  Reply,
  SealEditionInput,
} from "./types";

export class NotImplementedError extends Error {
  readonly method: string;

  constructor(method: string) {
    super(`${method} is not implemented in the v0.1 sketch`);
    this.name = "NotImplementedError";
    this.method = method;
  }
}

function fail(method: string): Promise<never> {
  return Promise.reject(new NotImplementedError(method));
}

export class StubApi {
  resolveComponent(_key: string): Promise<Reply<any>> {
    return fail("resolveComponent");
  }
  networkStatus(): Promise<Reply<any>> {
    return fail("networkStatus");
  }
  createPublication(_input: CreatePublicationInput): Promise<Reply<any>> {
    return fail("createPublication");
  }
  publicationInfo(_uri: string): Promise<Reply<any>> {
    return fail("publicationInfo");
  }
  publicationCharter(_uri: string): Promise<Reply<any>> {
    return fail("publicationCharter");
  }
  publicationMembers(_uri: string): Promise<Reply<any>> {
    return fail("publicationMembers");
  }
  addMember(_uri: string, _input: MemberInput): Promise<Reply<any>> {
    return fail("addMember");
  }
  removeMember(_uri: string, _input: MemberInput): Promise<Reply<any>> {
    return fail("removeMember");
  }
  setRole(_uri: string, _input: MemberInput): Promise<Reply<any>> {
    return fail("setRole");
  }
  attestSelf(_uri: string, _input: MemberInput): Promise<Reply<any>> {
    return fail("attestSelf");
  }
  pausePublication(
    _uri: string,
    _input: { opId: string; paused: boolean },
  ): Promise<Reply<any>> {
    return fail("pausePublication");
  }
  publicationAdmin(_uri: string, _input: AdminInput): Promise<Reply<any>> {
    return fail("publicationAdmin");
  }
  attachCover(
    _uri: string,
    _input: { opId: string; coverUri: string },
  ): Promise<Reply<any>> {
    return fail("attachCover");
  }
  proposeCommission(_input: ProposeCommissionInput): Promise<Reply<any>> {
    return fail("proposeCommission");
  }
  commissionProposalInfo(_uri: string): Promise<Reply<any>> {
    return fail("commissionProposalInfo");
  }
  acceptProposal(_uri: string, _input: { opId: string }): Promise<Reply<any>> {
    return fail("acceptProposal");
  }
  fundProposal(_uri: string, _input: { opId: string }): Promise<Reply<any>> {
    return fail("fundProposal");
  }
  submitMilestone(
    _escrowUri: string,
    _input: MilestoneActionInput,
  ): Promise<Reply<any>> {
    return fail("submitMilestone");
  }
  releaseMilestone(
    _escrowUri: string,
    _input: MilestoneActionInput,
  ): Promise<Reply<any>> {
    return fail("releaseMilestone");
  }
  cancelEscrow(
    _escrowUri: string,
    _input: { opId: string; reasonHash: string },
  ): Promise<Reply<any>> {
    return fail("cancelEscrow");
  }
  disputeEscrow(
    _escrowUri: string,
    _input: { opId: string; reasonHash: string },
  ): Promise<Reply<any>> {
    return fail("disputeEscrow");
  }
  arbitrateEscrow(_escrowUri: string, _input: ArbitrateInput): Promise<Reply<any>> {
    return fail("arbitrateEscrow");
  }
  expireEscrow(_escrowUri: string, _input: { opId: string }): Promise<Reply<any>> {
    return fail("expireEscrow");
  }
  escrowInfo(_uri: string): Promise<Reply<any>> {
    return fail("escrowInfo");
  }
  createArticle(_input: CreateArticleInput): Promise<Reply<any>> {
    return fail("createArticle");
  }
  submitArticle(
    _uri: string,
    _input: { opId: string; contentHash: string },
  ): Promise<Reply<any>> {
    return fail("submitArticle");
  }
  attachKnowledge(_uri: string, _input: KnowledgeInput): Promise<Reply<any>> {
    return fail("attachKnowledge");
  }
  attestArticle(_uri: string, _input: AttestInput): Promise<Reply<any>> {
    return fail("attestArticle");
  }
  approveArticle(_uri: string, _input: { opId: string }): Promise<Reply<any>> {
    return fail("approveArticle");
  }
  publishArticle(_uri: string, _input: { opId: string }): Promise<Reply<any>> {
    return fail("publishArticle");
  }
  correctArticle(_uri: string, _input: CorrectionInput): Promise<Reply<any>> {
    return fail("correctArticle");
  }
  retractArticle(
    _uri: string,
    _input: { opId: string; reasonHash: string },
  ): Promise<Reply<any>> {
    return fail("retractArticle");
  }
  articleInfo(_uri: string): Promise<Reply<any>> {
    return fail("articleInfo");
  }
  createEdition(_input: CreateEditionInput): Promise<Reply<any>> {
    return fail("createEdition");
  }
  appendEditionArticle(
    _uri: string,
    _input: { opId: string; articleUri: string },
  ): Promise<Reply<any>> {
    return fail("appendEditionArticle");
  }
  sealEdition(_uri: string, _input: SealEditionInput): Promise<Reply<any>> {
    return fail("sealEdition");
  }
  editionInfo(_uri: string): Promise<Reply<any>> {
    return fail("editionInfo");
  }
  coordinationInfo(_uri: string): Promise<Reply<any>> {
    return fail("coordinationInfo");
  }
  keystoreCreate(_input: KeystoreInput): Promise<Reply<any>> {
    return fail("keystoreCreate");
  }
  keystoreUnlock(
    _input: KeystoreInput & { document: string },
  ): Promise<Reply<any>> {
    return fail("keystoreUnlock");
  }
}
