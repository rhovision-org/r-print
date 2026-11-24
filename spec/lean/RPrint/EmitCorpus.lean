import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition
import RPrint.Model.Adapter
import RPrint.Model.Coordination

/-!
# Arm-level conformance corpus

`lake env lean RPrint/EmitCorpus.lean` prints one TSV row per promoted arm. The
row carries the case id, cell, arm, a short input description, the model
outcome (`some` or `reject`) and the theorem that carries the guard. The suite
assertion is tied to the case id by `harness/corpus.py` and
`tools/check_conformance.py`.

This is a finite evidence bundle, not a refinement of the deployed Rholang.
-/

namespace RPrint
namespace EmitCorpus

def member (role : Role) : Member :=
  { role := role, status := MemberStatus.active, didHash := 0, attestationHash := 0 }

def pubOne : PublicationState :=
  { publicationId := 1, status := PubStatus.active,
    members := [(1, member Role.publisher)], publishers := 1,
    admins := [], threshold := 1, arbitrators := [], arbitrationThreshold := 1,
    maxMembers := 128, nonce := 0, treasury := 0, charterHash := 0 }

def proposalProposed : ProposalState :=
  { proposalId := 1, writerId := 1, editorId := none, funderId := none,
    status := ProposalStatus.proposed, total := 1000, milestones := [] }

def proposalAccepted : ProposalState :=
  { proposalProposed with status := ProposalStatus.accepted }

def milestonePending : Milestone :=
  { milestoneId := 1, amount := 400, status := MilestoneStatus.pending,
    deadline := 100, evidenceHash := 0 }

def escrowActive : EscrowState :=
  { escrowId := 1, status := EscrowStatus.active, total := 1000, paidWriter := 0,
    refundedFunder := 0, purse := 1000, milestones := [milestonePending],
    graceBlocks := 0, disputeWindowBlocks := 0, hardDeadline := 100,
    disputeAt := none, nonce := 0 }

def escrowReleased : EscrowState :=
  { escrowActive with milestones := [{ milestonePending with status := MilestoneStatus.released }] }

def correction : Correction :=
  { kind := CorrectionKind.correction, bodyHash := 1, reasonHash := 2, articleHash := 9 }

def attestation1 : Attestation :=
  { id := 1, kind := 2, attestor := 3, evidenceHash := 4 }

def articleSubmitted : ArticleState :=
  { articleId := 1, publicationId := 1, firstAuthor := 1,
    status := ArticleStatus.submitted, contentHash := 9, kassetUri := none,
    requireKAsset := false, corrections := [], attestations := [],
    publishedContentHash := none }

def articleApproved : ArticleState :=
  { articleSubmitted with status := ArticleStatus.approved }

def articlePublished : ArticleState :=
  { articleApproved with status := ArticleStatus.published, publishedContentHash := some 9 }

def editionDraft : EditionState :=
  { editionId := 1, publicationId := 1, status := EditionStatus.draft,
    articles := [], sealHash := none, editorId := none, editorSig := none }

def entry : ManifestEntry :=
  { articleId := 1, articleUri := 1, contentHash := 9 }

def coverBase : CoverState :=
  { proposalId := 1, proposalStatus := ProposalStatus.accepted, treasury := 9,
    assetId := 7, coverUri := none, coverStatus := none, coverAssetId := none,
    coverPerClaimLimit := none, coverAggregateRemaining := none, coverInsured := none }

def coverPolicy : PolicyFact :=
  { status := CoverFactStatus.active, insured := 9, assetId := 7,
    perClaimLimit := 100, aggregateRemaining := 1000 }

def knowledgeBase : KnowledgeState :=
  { articleId := 1, status := ArticleStatus.submitted, contentHash := 9,
    authors := [3], kassetUri := none, claimUri := none, provenanceUri := none,
    credentialUri := none, knowledgeAtHeight := 0 }

def kassetFact : KAssetFact :=
  { uri := 11, claimUri := 12 }

def claimFact : ClaimFact :=
  { uri := 12, kassetUri := 11, status := ClaimFactStatus.validated, claimant := 3 }

def provenanceFact : ProvenanceFact :=
  { uri := 13, assetUri := 11, claimUri := 12, writers := [3], hashOk := true }

def credentialFact : Option CredentialFact :=
  some { uri := 14, subject := 3, status := CredentialFactStatus.active, expiresAt := 0 }

def coordinationOpen : CoordinationState :=
  { coordinationId := 1, publicationId := 1, status := CoordinationStatus.open,
    roomIdHash := 2, pollIdHash := none, outcomeHash := none,
    signers := [1, 2], signatures := [] }

def coordinationRecorded : CoordinationState :=
  { coordinationId := 1, publicationId := 1, status := CoordinationStatus.recorded,
    roomIdHash := 2, pollIdHash := some 3, outcomeHash := some 4,
    signers := [1, 2], signatures := [1, 2] }

def outcome {α : Type} (o : Option α) : String :=
  if o.isSome then "some" else "reject"

structure VectorRow where
  caseId : String
  cell : String
  arm : String
  input : String
  expected : String
  leanDecl : String

def row (caseId cell arm input expected leanDecl : String) : VectorRow :=
  { caseId := caseId, cell := cell, arm := arm, input := input,
    expected := expected, leanDecl := leanDecl }

def rows : List VectorRow := [
  row "PUB-add-nonpublisher" "Publication" "addMember" "caller not publisher"
    (outcome (publicationAddMember pubOne 2 3 Role.editor 0 0))
    "RPrint.publication_addMember_requires_publisher",
  row "PUB-remove-last" "Publication" "removeMember" "last publisher"
    (outcome (publicationRemoveMember pubOne 1 1))
    "RPrint.publication_removeMember_refuses_last_publisher",
  row "PUB-admin-replay" "Publication" "admin" "replayed nonce"
    (outcome (publicationAdmin pubOne 0 AdminAction.pause true))
    "RPrint.publication_admin_replay_refused",
  row "PUB-pause-nonpublisher" "Publication" "pause" "caller not publisher"
    (outcome (publicationPause pubOne 2 true))
    "RPrint.publication_pause_requires_publisher",
  row "COM-propose-ok" "CommissionFactory" "propose" "writer proposes"
    (outcome (commissionPropose 1 1 true 1000 []))
    "RPrint.commission_propose_initial",
  row "COM-accept-ok" "CommissionProposal" "accept" "editor accepts"
    (outcome (commissionAccept proposalProposed 2 true))
    "RPrint.commission_accept_sets_editor",
  row "COM-fund-ok" "CommissionProposal" "fund" "accepted proposal"
    (outcome (commissionFund proposalAccepted 3))
    "RPrint.commission_fund_creates_active_escrow",
  row "ESC-release-double" "CommissionEscrow" "release" "released milestone"
    (outcome (escrowRelease escrowReleased true true 1))
    "RPrint.escrow_release_pays_once",
  row "ESC-cancel-ok" "CommissionEscrow" "cancel" "active escrow"
    (outcome (escrowCancel escrowActive true))
    "RPrint.escrow_cancel_conserves",
  row "ESC-expire-ok" "CommissionEscrow" "expire" "deadline reached"
    (outcome (escrowExpire escrowActive 100))
    "RPrint.escrow_expire_conserves",
  row "ESC-arbitrate-replay" "CommissionEscrow" "arbitrate" "replayed nonce"
    (outcome (escrowArbitrate { escrowActive with
      status := EscrowStatus.disputed, nonce := 1 } 1 5000 true))
    "RPrint.escrow_arbitrate_replay_refused",
  row "ART-submit-nonauthor" "Article" "submit" "caller not author"
    (outcome (articleSubmit { articleSubmitted with status := ArticleStatus.draft } false 9))
    "RPrint.article_submit_requires_author",
  row "ART-publish-unapproved" "Article" "publish" "not approved"
    (outcome (articlePublish articleSubmitted true))
    "RPrint.article_publish_requires_approved",
  row "ART-correct-append" "Article" "correct" "published article"
    (outcome (articleCorrect articlePublished true correction))
    "RPrint.article_correct_append_only",
  row "ART-attest-ok" "Article" "attest" "submitted article"
    (outcome (articleAttest articleSubmitted true attestation1))
    "RPrint.article_attest_append_only",
  row "ED-append-duplicate" "Edition" "append" "duplicate article"
    (outcome (editionAppend { editionDraft with articles := [entry] } true 1
      ArticleStatus.published 1 1 9))
    "RPrint.edition_append_refuses_duplicate",
  row "ED-seal-ok" "Edition" "seal" "non-empty manifest, valid signature"
    (outcome (editionSeal { editionDraft with articles := [entry] } true 1 7 true))
    "RPrint.edition_seal_binds_manifest",
  row "COV-attach-inactive" "CommissionProposal" "attachCover" "inactive policy"
    (outcome (coverAttach coverBase 21
      { coverPolicy with status := CoverFactStatus.inactive }))
    "RPrint.cover_attach_requires_active_policy",
  row "KNO-attach-claim-status" "Article" "attachKnowledge" "open claim"
    (outcome (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact { claimFact with status := ClaimFactStatus.open }
      provenanceFact credentialFact 50))
    "RPrint.knowledge_attach_requires_claim_status",
  row "COORD-record-conflict" "CoordinationRecord" "record"
    "recorded, different outcome"
    (outcome (coordinationRecord coordinationRecorded
      true true true true true true true 3 5 2))
    "RPrint.coordination_record_record_conflict_refused"
]

def header : String :=
  "case_id\tcell\tarm\tinput\texpected\tlean_decl"

def VectorRow.line (r : VectorRow) : String :=
  String.intercalate "\t" [r.caseId, r.cell, r.arm, r.input, r.expected, r.leanDecl]

def render : String :=
  String.intercalate "\n" (header :: rows.map VectorRow.line) ++ "\n"

end EmitCorpus
end RPrint

#eval IO.print RPrint.EmitCorpus.render
