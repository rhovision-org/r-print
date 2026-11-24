import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition
import RPrint.Model.Adapter

/-!
# Arm guards

One positive `Bool` guard per mutating arm. Each guard is the negation of the
arm's refusal branches, and each `_guard_eq` theorem proves

    (step <args>).isSome = guard <args>

so a vector harness can decide arm success from the guard alone without
re-running the transition. A guard that is a constant `true` (or that mentions
`step.isSome`) would be a tautology and is rejected by review; every guard here
is a genuine conjunction of the arm's own success conditions.

`spec/guards/arms.yaml` references these names: the guard is `<arm>Guard`, the
theorem `<arm>_guard_eq`, where `<arm>` is the model function name.

Some guard parameters are structurally unused (e.g. the milestone id does not
gate a submit); the linter is therefore quieted for this file only.
-/

set_option linter.unusedVariables false

namespace RPrint

/-! ## Publication authority -/

def publicationAddMemberGuard (s : PublicationState) (caller id : Id) (role : Role)
    (didHash attestationHash : Id) : Bool :=
  isPublisher s caller && !(s.members.length ≥ s.maxMembers) &&
    !(findMember s.members id).isSome

theorem publicationAddMember_guard_eq (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) :
    (publicationAddMember s caller id role didHash attestationHash).isSome =
      publicationAddMemberGuard s caller id role didHash attestationHash := by
  cases hp : isPublisher s caller with
  | false => simp [publicationAddMember, publicationAddMemberGuard, hp]
  | true =>
      by_cases hcap : s.members.length ≥ s.maxMembers
      · simp [publicationAddMember, publicationAddMemberGuard, hp, hcap]
      · cases hdup : (findMember s.members id).isSome with
        | false => simp [publicationAddMember, publicationAddMemberGuard, hp, hcap, hdup]
        | true => simp [publicationAddMember, publicationAddMemberGuard, hp, hcap, hdup]

def publicationRemoveMemberGuard (s : PublicationState) (caller target : Id) : Bool :=
  isPublisher s caller && !(isPublisher s target && s.publishers ≤ 1)

theorem publicationRemoveMember_guard_eq (s : PublicationState) (caller target : Id) :
    (publicationRemoveMember s caller target).isSome =
      publicationRemoveMemberGuard s caller target := by
  cases hp : isPublisher s caller with
  | false => simp [publicationRemoveMember, publicationRemoveMemberGuard, hp]
  | true =>
      cases hlast : (isPublisher s target && s.publishers ≤ 1) with
      | false => simp [publicationRemoveMember, publicationRemoveMemberGuard, hp, hlast]
      | true => simp [publicationRemoveMember, publicationRemoveMemberGuard, hp, hlast]

def publicationSetRoleGuard (s : PublicationState) (caller target : Id) (role : Role) : Bool :=
  isPublisher s caller && !(isPublisher s target && !isPublisherRole role && s.publishers ≤ 1)

theorem publicationSetRole_guard_eq (s : PublicationState) (caller target : Id)
    (role : Role) :
    (publicationSetRole s caller target role).isSome =
      publicationSetRoleGuard s caller target role := by
  cases hp : isPublisher s caller with
  | false => simp [publicationSetRole, publicationSetRoleGuard, hp]
  | true =>
      cases hdem : (isPublisher s target && !isPublisherRole role && s.publishers ≤ 1) with
      | false => simp [publicationSetRole, publicationSetRoleGuard, hp, hdem]
      | true => simp [publicationSetRole, publicationSetRoleGuard, hp, hdem]

def publicationAttestSelfGuard (s : PublicationState) (caller didHash attestationHash : Id) : Bool :=
  memberActive s caller

theorem publicationAttestSelf_guard_eq (s : PublicationState) (caller didHash attestationHash : Id) :
    (publicationAttestSelf s caller didHash attestationHash).isSome =
      publicationAttestSelfGuard s caller didHash attestationHash := by
  cases h : memberActive s caller with
  | false => simp [publicationAttestSelf, publicationAttestSelfGuard, h]
  | true => simp [publicationAttestSelf, publicationAttestSelfGuard, h]

def publicationPauseGuard (s : PublicationState) (caller : Id) (paused : Bool) : Bool :=
  isPublisher s caller

theorem publicationPause_guard_eq (s : PublicationState) (caller : Id) (paused : Bool) :
    (publicationPause s caller paused).isSome =
      publicationPauseGuard s caller paused := by
  cases h : isPublisher s caller with
  | false => simp [publicationPause, publicationPauseGuard, h]
  | true => simp [publicationPause, publicationPauseGuard, h]

def publicationAdminGuard (s : PublicationState) (nonce : Nat) (action : AdminAction)
    (authorized : Bool) : Bool :=
  !(nonce ≤ s.nonce) && authorized &&
    match action with
    | AdminAction.pause => true
    | AdminAction.resume => true
    | AdminAction.setAdmins keys => keys.length ≥ 2
    | AdminAction.setThreshold n => n ≥ 1
    | AdminAction.setTreasury id => true

theorem publicationAdmin_guard_eq (s : PublicationState) (nonce : Nat)
    (action : AdminAction) (authorized : Bool) :
    (publicationAdmin s nonce action authorized).isSome =
      publicationAdminGuard s nonce action authorized := by
  by_cases hnonce : nonce ≤ s.nonce
  · simp [publicationAdmin, publicationAdminGuard, hnonce]
  · cases hauth : authorized with
    | false => simp [publicationAdmin, publicationAdminGuard, hnonce, hauth]
    | true =>
        cases action with
        | pause => simp [publicationAdmin, publicationAdminGuard, hnonce, hauth]
        | resume => simp [publicationAdmin, publicationAdminGuard, hnonce, hauth]
        | setAdmins keys =>
            by_cases hk : keys.length ≥ 2
            · simp [publicationAdmin, publicationAdminGuard, hnonce, hauth, hk]
            · simp [publicationAdmin, publicationAdminGuard, hnonce, hauth, hk]
        | setThreshold n =>
            by_cases hn : n ≥ 1
            · simp [publicationAdmin, publicationAdminGuard, hnonce, hauth, hn]
            · simp [publicationAdmin, publicationAdminGuard, hnonce, hauth, hn]
        | setTreasury id => simp [publicationAdmin, publicationAdminGuard, hnonce, hauth]

/-! ## Commission proposal and escrow -/

def commissionProposeGuard (proposalId caller : Id) (callerIsWriter : Bool)
    (total : Amount) (milestones : List Milestone) : Bool :=
  callerIsWriter

theorem commissionPropose_guard_eq (proposalId caller : Id) (callerIsWriter : Bool)
    (total : Amount) (milestones : List Milestone) :
    (commissionPropose proposalId caller callerIsWriter total milestones).isSome =
      commissionProposeGuard proposalId caller callerIsWriter total milestones := by
  cases h : callerIsWriter with
  | false => simp [commissionPropose, commissionProposeGuard, h]
  | true => simp [commissionPropose, commissionProposeGuard, h]

def commissionAcceptGuard (p : ProposalState) (caller : Id) (isEditor : Bool) : Bool :=
  isEditor && (p.status = ProposalStatus.proposed)

theorem commissionAccept_guard_eq (p : ProposalState) (caller : Id) (isEditor : Bool) :
    (commissionAccept p caller isEditor).isSome =
      commissionAcceptGuard p caller isEditor := by
  cases he : isEditor with
  | false => simp [commissionAccept, commissionAcceptGuard, he]
  | true =>
      by_cases hp : p.status = ProposalStatus.proposed
      · simp [commissionAccept, commissionAcceptGuard, he, hp]
      · simp [commissionAccept, commissionAcceptGuard, he, hp]

def commissionFundGuard (p : ProposalState) (funder : Id) : Bool :=
  p.status = ProposalStatus.accepted

theorem commissionFund_guard_eq (p : ProposalState) (funder : Id) :
    (commissionFund p funder).isSome = commissionFundGuard p funder := by
  by_cases hp : p.status = ProposalStatus.accepted
  · simp [commissionFund, commissionFundGuard, hp]
  · simp [commissionFund, commissionFundGuard, hp]

def commissionCancelGuard (p : ProposalState) (authorized : Bool) : Bool :=
  authorized && (p.status = ProposalStatus.proposed ∨ p.status = ProposalStatus.accepted)

theorem commissionCancel_guard_eq (p : ProposalState) (authorized : Bool) :
    (commissionCancel p authorized).isSome = commissionCancelGuard p authorized := by
  cases ha : authorized with
  | false => simp [commissionCancel, commissionCancelGuard, ha]
  | true =>
      by_cases hs : p.status = ProposalStatus.proposed ∨ p.status = ProposalStatus.accepted
      · simp [commissionCancel, commissionCancelGuard, ha, hs]
      · simp [commissionCancel, commissionCancelGuard, ha, hs]

def escrowSubmitGuard (s : EscrowState) (callerIsWriter : Bool) (mStatus : MilestoneStatus)
    (milestoneId : Id) (now deadline : Height) : Bool :=
  callerIsWriter && (s.status = EscrowStatus.active) &&
    (mStatus = MilestoneStatus.pending) && (now ≤ deadline + s.graceBlocks)

theorem escrowSubmit_guard_eq (s : EscrowState) (callerIsWriter : Bool)
    (mStatus : MilestoneStatus) (milestoneId : Id) (now deadline : Height) :
    (escrowSubmit s callerIsWriter mStatus milestoneId now deadline).isSome =
      escrowSubmitGuard s callerIsWriter mStatus milestoneId now deadline := by
  cases hw : callerIsWriter with
  | false => simp [escrowSubmit, escrowSubmitGuard, hw]
  | true =>
      by_cases ha : s.status = EscrowStatus.active
      · by_cases hp : mStatus = MilestoneStatus.pending
        · by_cases hl : now ≤ deadline + s.graceBlocks
          · simp [escrowSubmit, escrowSubmitGuard, hw, ha, hp, hl]
          · simp [escrowSubmit, escrowSubmitGuard, hw, ha, hp, hl]
        · simp [escrowSubmit, escrowSubmitGuard, hw, ha, hp]
      · simp [escrowSubmit, escrowSubmitGuard, hw, ha]

def escrowReleaseGuard (s : EscrowState) (callerIsEditor : Bool) (mStatus : MilestoneStatus)
    (priorReleased : Bool) (milestoneId : Id) (amount : Amount) : Bool :=
  callerIsEditor && (s.status = EscrowStatus.active) &&
    (mStatus = MilestoneStatus.submitted) && priorReleased && (amount ≤ s.purse)

theorem escrowRelease_guard_eq (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id) (amount : Amount) :
    (escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount).isSome =
      escrowReleaseGuard s callerIsEditor mStatus priorReleased milestoneId amount := by
  cases he : callerIsEditor with
  | false => simp [escrowRelease, escrowReleaseGuard, he]
  | true =>
      by_cases ha : s.status = EscrowStatus.active
      · by_cases hm : mStatus = MilestoneStatus.submitted
        · cases hp : priorReleased with
          | false => simp [escrowRelease, escrowReleaseGuard, he, ha, hm, hp]
          | true =>
              by_cases hb : amount ≤ s.purse
              · simp [escrowRelease, escrowReleaseGuard, he, ha, hm, hp, hb]
              · simp [escrowRelease, escrowReleaseGuard, he, ha, hm, hp, hb]
        · simp [escrowRelease, escrowReleaseGuard, he, ha, hm]
      · simp [escrowRelease, escrowReleaseGuard, he, ha]

def escrowCancelGuard (s : EscrowState) (callerAuthorized : Bool) : Bool :=
  callerAuthorized && (s.status = EscrowStatus.active)

theorem escrowCancel_guard_eq (s : EscrowState) (callerAuthorized : Bool) :
    (escrowCancel s callerAuthorized).isSome = escrowCancelGuard s callerAuthorized := by
  cases ha : callerAuthorized with
  | false => simp [escrowCancel, escrowCancelGuard, ha]
  | true =>
      by_cases hs : s.status = EscrowStatus.active
      · simp [escrowCancel, escrowCancelGuard, ha, hs]
      · simp [escrowCancel, escrowCancelGuard, ha, hs]

def escrowExpireGuard (s : EscrowState) (now : Height) : Bool :=
  (s.status = EscrowStatus.active) && (now ≥ s.hardDeadline)

theorem escrowExpire_guard_eq (s : EscrowState) (now : Height) :
    (escrowExpire s now).isSome = escrowExpireGuard s now := by
  by_cases hs : s.status = EscrowStatus.active
  · by_cases ht : now ≥ s.hardDeadline
    · simp [escrowExpire, escrowExpireGuard, hs, ht]
    · simp [escrowExpire, escrowExpireGuard, hs, ht]
  · simp [escrowExpire, escrowExpireGuard, hs]

def escrowDisputeGuard (s : EscrowState) (callerAuthorized : Bool) (now : Height) : Bool :=
  callerAuthorized && (s.status = EscrowStatus.active)

theorem escrowDispute_guard_eq (s : EscrowState) (callerAuthorized : Bool) (now : Height) :
    (escrowDispute s callerAuthorized now).isSome =
      escrowDisputeGuard s callerAuthorized now := by
  cases ha : callerAuthorized with
  | false => simp [escrowDispute, escrowDisputeGuard, ha]
  | true =>
      by_cases hs : s.status = EscrowStatus.active
      · simp [escrowDispute, escrowDisputeGuard, ha, hs]
      · simp [escrowDispute, escrowDisputeGuard, ha, hs]

def escrowArbitrateGuard (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) : Bool :=
  (s.status = EscrowStatus.disputed) && !(nonce ≤ s.nonce) && authorized &&
    !(writerBps > Bps)

theorem escrowArbitrate_guard_eq (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) :
    (escrowArbitrate s nonce writerBps authorized).isSome =
      escrowArbitrateGuard s nonce writerBps authorized := by
  by_cases hd : s.status = EscrowStatus.disputed
  · by_cases hn : nonce ≤ s.nonce
    · simp [escrowArbitrate, escrowArbitrateGuard, hd, hn]
    · cases ha : authorized with
      | false => simp [escrowArbitrate, escrowArbitrateGuard, hd, hn, ha]
      | true =>
          by_cases hb : writerBps > Bps
          · simp [escrowArbitrate, escrowArbitrateGuard, hd, hn, ha, hb]
          · simp [escrowArbitrate, escrowArbitrateGuard, hd, hn, ha, hb]
  · simp [escrowArbitrate, escrowArbitrateGuard, hd]

def escrowResolveDisputeGuard (s : EscrowState) (now : Height) : Bool :=
  (s.status = EscrowStatus.disputed) &&
    match s.disputeAt with
    | some h => now ≥ h + s.disputeWindowBlocks
    | none => false

theorem escrowResolveDispute_guard_eq (s : EscrowState) (now : Height) :
    (escrowResolveDispute s now).isSome = escrowResolveDisputeGuard s now := by
  by_cases hd : s.status = EscrowStatus.disputed
  · cases hdis : s.disputeAt with
    | none => simp [escrowResolveDispute, escrowResolveDisputeGuard, hd, hdis]
    | some h =>
        by_cases hl : now ≥ h + s.disputeWindowBlocks
        · simp [escrowResolveDispute, escrowResolveDisputeGuard, hd, hdis, hl]
        · simp [escrowResolveDispute, escrowResolveDisputeGuard, hd, hdis, hl]
  · simp [escrowResolveDispute, escrowResolveDisputeGuard, hd]

/-! ## Article lifecycle -/

def articleSubmitGuard (s : ArticleState) (callerIsAuthor : Bool) (newHash : Id) : Bool :=
  callerIsAuthor && (s.status = ArticleStatus.draft)

theorem articleSubmit_guard_eq (s : ArticleState) (callerIsAuthor : Bool) (newHash : Id) :
    (articleSubmit s callerIsAuthor newHash).isSome =
      articleSubmitGuard s callerIsAuthor newHash := by
  cases ha : callerIsAuthor with
  | false => simp [articleSubmit, articleSubmitGuard, ha]
  | true =>
      by_cases hs : s.status = ArticleStatus.draft
      · simp [articleSubmit, articleSubmitGuard, ha, hs]
      · simp [articleSubmit, articleSubmitGuard, ha, hs]

def articleAttachKnowledgeGuard (s : ArticleState) (callerAuthorized : Bool)
    (kassetUri : Id) : Bool :=
  callerAuthorized && (s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved)

theorem articleAttachKnowledge_guard_eq (s : ArticleState) (callerAuthorized : Bool)
    (kassetUri : Id) :
    (articleAttachKnowledge s callerAuthorized kassetUri).isSome =
      articleAttachKnowledgeGuard s callerAuthorized kassetUri := by
  cases ha : callerAuthorized with
  | false => simp [articleAttachKnowledge, articleAttachKnowledgeGuard, ha]
  | true =>
      by_cases hs : s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved
      · simp [articleAttachKnowledge, articleAttachKnowledgeGuard, ha, hs]
      · simp [articleAttachKnowledge, articleAttachKnowledgeGuard, ha, hs]

def articleApproveGuard (s : ArticleState) (callerIsEditor : Bool) : Bool :=
  callerIsEditor && (s.status = ArticleStatus.submitted) &&
    !(s.requireKAsset && s.kassetUri.isNone)

theorem articleApprove_guard_eq (s : ArticleState) (callerIsEditor : Bool) :
    (articleApprove s callerIsEditor).isSome = articleApproveGuard s callerIsEditor := by
  cases he : callerIsEditor with
  | false => simp [articleApprove, articleApproveGuard, he]
  | true =>
      by_cases hs : s.status = ArticleStatus.submitted
      · cases hr : s.requireKAsset with
        | false => simp [articleApprove, articleApproveGuard, he, hs, hr]
        | true =>
            cases hk : s.kassetUri with
            | none => simp [articleApprove, articleApproveGuard, he, hs, hr, hk]
            | some u => simp [articleApprove, articleApproveGuard, he, hs, hr, hk]
      · simp [articleApprove, articleApproveGuard, he, hs]

def articlePublishGuard (s : ArticleState) (callerIsEditor : Bool) : Bool :=
  callerIsEditor && (s.status = ArticleStatus.approved)

theorem articlePublish_guard_eq (s : ArticleState) (callerIsEditor : Bool) :
    (articlePublish s callerIsEditor).isSome = articlePublishGuard s callerIsEditor := by
  cases he : callerIsEditor with
  | false => simp [articlePublish, articlePublishGuard, he]
  | true =>
      by_cases hs : s.status = ArticleStatus.approved
      · simp [articlePublish, articlePublishGuard, he, hs]
      · simp [articlePublish, articlePublishGuard, he, hs]

def articleCorrectGuard (s : ArticleState) (callerIsEditor : Bool) (correction : Correction) : Bool :=
  callerIsEditor && (s.status = ArticleStatus.published ∨ s.status = ArticleStatus.retracted) &&
    !(s.corrections.length ≥ 32)

theorem articleCorrect_guard_eq (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) :
    (articleCorrect s callerIsEditor correction).isSome =
      articleCorrectGuard s callerIsEditor correction := by
  cases he : callerIsEditor with
  | false => simp [articleCorrect, articleCorrectGuard, he]
  | true =>
      by_cases hs : s.status = ArticleStatus.published ∨ s.status = ArticleStatus.retracted
      · by_cases hc : s.corrections.length ≥ 32
        · simp [articleCorrect, articleCorrectGuard, he, hs, hc]
        · simp [articleCorrect, articleCorrectGuard, he, hs, hc]
      · simp [articleCorrect, articleCorrectGuard, he, hs]

def articleRetractGuard (s : ArticleState) (callerIsEditor : Bool) (reasonHash : Id) : Bool :=
  callerIsEditor && (s.status = ArticleStatus.published)

theorem articleRetract_guard_eq (s : ArticleState) (callerIsEditor : Bool) (reasonHash : Id) :
    (articleRetract s callerIsEditor reasonHash).isSome =
      articleRetractGuard s callerIsEditor reasonHash := by
  cases he : callerIsEditor with
  | false => simp [articleRetract, articleRetractGuard, he]
  | true =>
      by_cases hs : s.status = ArticleStatus.published
      · simp [articleRetract, articleRetractGuard, he, hs]
      · simp [articleRetract, articleRetractGuard, he, hs]

def articleAttestGuard (s : ArticleState) (callerQualified : Bool) (attestation : Attestation) : Bool :=
  callerQualified && (s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved) &&
    !(s.attestations.length ≥ 16)

theorem articleAttest_guard_eq (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) :
    (articleAttest s callerQualified attestation).isSome =
      articleAttestGuard s callerQualified attestation := by
  cases hq : callerQualified with
  | false => simp [articleAttest, articleAttestGuard, hq]
  | true =>
      by_cases hs : s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved
      · by_cases hc : s.attestations.length ≥ 16
        · simp [articleAttest, articleAttestGuard, hq, hs, hc]
        · simp [articleAttest, articleAttestGuard, hq, hs, hc]
      · simp [articleAttest, articleAttestGuard, hq, hs]

/-! ## Edition seal -/

def editionAppendGuard (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) : Bool :=
  callerIsEditor && (s.status = EditionStatus.draft) &&
    (articleStatus = ArticleStatus.published) && (articlePublication = s.publicationId) &&
    !(s.articles.any (fun e => e.articleId = articleId)) && !(s.articles.length ≥ 64)

theorem editionAppend_guard_eq (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) :
    (editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash).isSome =
      editionAppendGuard s callerIsEditor articlePublication articleStatus articleId
        articleUri contentHash := by
  cases he : callerIsEditor with
  | false => simp [editionAppend, editionAppendGuard, he]
  | true =>
      by_cases hd : s.status = EditionStatus.draft
      · by_cases hp : articleStatus = ArticleStatus.published
        · by_cases hpub : articlePublication = s.publicationId
          · cases hdup : (s.articles.any (fun e => e.articleId = articleId)) with
            | false =>
                by_cases hcap : s.articles.length ≥ 64
                · simp [editionAppend, editionAppendGuard, he, hd, hp, hpub, hdup, hcap]
                · simp [editionAppend, editionAppendGuard, he, hd, hp, hpub, hdup, hcap]
            | true => simp [editionAppend, editionAppendGuard, he, hd, hp, hpub, hdup]
          · simp [editionAppend, editionAppendGuard, he, hd, hp, hpub]
        · simp [editionAppend, editionAppendGuard, he, hd, hp]
      · simp [editionAppend, editionAppendGuard, he, hd]

def editionSealGuard (s : EditionState) (callerIsEditor : Bool) (editorId : Id)
    (manifestHash : Id) (sigOk : Bool) : Bool :=
  callerIsEditor && (s.status = EditionStatus.draft) && (s.articles.length > 0) && sigOk

theorem editionSeal_guard_eq (s : EditionState) (callerIsEditor : Bool) (editorId : Id)
    (manifestHash : Id) (sigOk : Bool) :
    (editionSeal s callerIsEditor editorId manifestHash sigOk).isSome =
      editionSealGuard s callerIsEditor editorId manifestHash sigOk := by
  cases he : callerIsEditor with
  | false => simp [editionSeal, editionSealGuard, he]
  | true =>
      by_cases hd : s.status = EditionStatus.draft
      · by_cases hn : s.articles.length > 0
        · cases hs : sigOk with
          | false => simp [editionSeal, editionSealGuard, he, hd, hn, hs]
          | true => simp [editionSeal, editionSealGuard, he, hd, hn, hs]
        · simp [editionSeal, editionSealGuard, he, hd, hn]
      · simp [editionSeal, editionSealGuard, he, hd]

/-! ## r-sure cover (sibling adapter) -/

def coverAttachGuard (s : CoverState) (uri : Id) (p : PolicyFact) : Bool :=
  coverOpen s &&
    match s.coverUri with
    | some u => u = uri
    | none => coverOk s p

theorem coverAttach_guard_eq (s : CoverState) (uri : Id) (p : PolicyFact) :
    (coverAttach s uri p).isSome = coverAttachGuard s uri p := by
  cases ho : coverOpen s with
  | false => simp [coverAttach, coverAttachGuard, ho]
  | true =>
      cases hc : s.coverUri with
      | none =>
          cases hok : coverOk s p with
          | false => simp [coverAttach, coverAttachGuard, ho, hc, hok]
          | true => simp [coverAttach, coverAttachGuard, ho, hc, hok]
      | some u =>
          by_cases heq : u = uri
          · simp [coverAttach, coverAttachGuard, ho, hc, heq]
          · simp [coverAttach, coverAttachGuard, ho, hc, heq]

end RPrint
