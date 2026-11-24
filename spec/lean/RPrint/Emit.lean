import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition
import RPrint.Model.Adapter

/-!
# Deterministic vectors

`lake env lean RPrint/Emit.lean` prints `name|input|output` lines. The vector
checker compares the committed `spec/vectors/lean.json` with a fresh emission.
Each line is a small conformance example for one of the four cores.
-/

namespace RPrint
namespace Emit

def pubStatusName : PubStatus → String
  | PubStatus.active => "active"
  | PubStatus.paused => "paused"

def proposalStatusName : ProposalStatus → String
  | ProposalStatus.proposed => "proposed"
  | ProposalStatus.accepted => "accepted"
  | ProposalStatus.funded => "funded"
  | ProposalStatus.cancelled => "cancelled"

def escrowStatusName : EscrowStatus → String
  | EscrowStatus.active => "active"
  | EscrowStatus.completed => "completed"
  | EscrowStatus.cancelled => "cancelled"
  | EscrowStatus.disputed => "disputed"
  | EscrowStatus.arbitrated => "arbitrated"
  | EscrowStatus.expired => "expired"

def articleStatusName : ArticleStatus → String
  | ArticleStatus.draft => "draft"
  | ArticleStatus.submitted => "submitted"
  | ArticleStatus.approved => "approved"
  | ArticleStatus.published => "published"
  | ArticleStatus.retracted => "retracted"

def editionStatusName : EditionStatus → String
  | EditionStatus.draft => "draft"
  | EditionStatus.sealed => "sealed"

def arbSourceName : ArbSource → String
  | ArbSource.arbitrators => "arbitrators"
  | ArbSource.admins => "admins"
  | ArbSource.platform => "platform"

def okNone {α : Type} (o : Option α) : String :=
  match o with
  | some _ => "ok"
  | none => "none"

def escrowLine (o : Option EscrowState) : String :=
  match o with
  | none => "none"
  | some s =>
      s!"{escrowStatusName s.status},{s.paidWriter},{s.refundedFunder},{s.purse},{s.total}"

def articleLine (o : Option ArticleState) : String :=
  match o with
  | none => "none"
  | some s => s!"{articleStatusName s.status},{s.contentHash},{s.corrections.length}"

def optId : Option Id → String
  | none => "none"
  | some x => toString x

def coverLine (o : Option CoverState) : String :=
  match o with
  | none => "none"
  | some s => s!"{optId s.coverUri},{optId s.coverInsured},{optId s.coverAssetId}"

def knowledgeLine (o : Option KnowledgeState) : String :=
  match o with
  | none => "none"
  | some s =>
      s!"{articleStatusName s.status},{optId s.kassetUri},{optId s.claimUri},"
        ++ s!"{optId s.provenanceUri},{optId s.credentialUri},{s.knowledgeAtHeight}"

def editionLine (o : Option EditionState) : String :=
  match o with
  | none => "none"
  | some s => s!"{editionStatusName s.status},{s.articles.length}"

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

def escrowActive : EscrowState :=
  { escrowId := 1, status := EscrowStatus.active, total := 1000, paidWriter := 0,
    refundedFunder := 0, purse := 1000, milestones := [], graceBlocks := 0,
    disputeWindowBlocks := 0, hardDeadline := 100, disputeAt := none, nonce := 0 }

def articleDraft : ArticleState :=
  { articleId := 1, publicationId := 1, firstAuthor := 1, status := ArticleStatus.draft,
    contentHash := 0, kassetUri := none, requireKAsset := false, corrections := [],
    attestations := [], publishedContentHash := none }

def articleSubmitted : ArticleState :=
  { articleDraft with status := ArticleStatus.submitted, contentHash := 9 }

def articleApproved : ArticleState :=
  { articleDraft with status := ArticleStatus.approved, contentHash := 9 }

def attestation1 : Attestation :=
  { id := 1, kind := 2, attestor := 3, evidenceHash := 4 }

def articleFull : ArticleState :=
  { articleSubmitted with attestations := List.replicate 16 attestation1 }

def articleAttestLine (o : Option ArticleState) : String :=
  match o with
  | none => "none"
  | some s => s!"{articleStatusName s.status},{s.contentHash},{s.attestations.length}"

def correction : Correction :=
  { kind := CorrectionKind.correction, bodyHash := 1, reasonHash := 2, articleHash := 9 }

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

def emit (name input output : String) : IO Unit :=
  IO.println s!"{name}|{input}|{output}"

def main : IO Unit := do
  emit "publication.addMember.ok" "2,editor"
    (okNone (publicationAddMember pubOne 1 2 Role.editor 0 0))
  emit "publication.addMember.not_publisher" "2,editor"
    (okNone (publicationAddMember pubOne 2 3 Role.editor 0 0))
  emit "publication.removeMember.last_publisher" "1"
    (okNone (publicationRemoveMember pubOne 1 1))
  emit "publication.setRole.last_publisher" "1,writer"
    (okNone (publicationSetRole pubOne 1 1 Role.writer))
  emit "publication.pause.ok" "1"
    (match publicationPause pubOne 1 true with
     | none => "none"
     | some s => pubStatusName s.status)
  emit "publication.pause.not_publisher" "2"
    (okNone (publicationPause pubOne 2 true))
  emit "publication.admin.replay" "0,pause"
    (okNone (publicationAdmin pubOne 0 AdminAction.pause true))
  emit "publication.arbitration.platform" ""
    (arbSourceName (publicationArbitration [] 2 pubOne).source)

  emit "commission.accept.ok" "2"
    (match commissionAccept proposalProposed 2 true with
     | none => "none"
     | some p => proposalStatusName p.status)
  emit "commission.accept.wrong_status" "2"
    (okNone (commissionAccept proposalAccepted 2 true))
  emit "commission.fund.ok" "3"
    (match commissionFund proposalAccepted 3 with
     | none => "none"
     | some (_, e) => s!"{escrowStatusName e.status},{e.purse},{e.total}")
  emit "commission.fund.not_accepted" "3"
    (okNone (commissionFund proposalProposed 3))
  emit "commission.cancel.ok" "true"
    (match commissionCancel proposalAccepted true with
     | none => "none"
     | some p => proposalStatusName p.status)

  emit "escrow.submit.too_late" "pending,100,10"
    (okNone (escrowSubmit escrowActive true MilestoneStatus.pending 1 100 10))
  emit "escrow.release.ok" "submitted,true,400"
    (escrowLine (escrowRelease escrowActive true MilestoneStatus.submitted true 1 400))
  emit "escrow.release.double" "released,true,400"
    (escrowLine (escrowRelease escrowActive true MilestoneStatus.released true 1 400))
  emit "escrow.release.prior" "submitted,false,400"
    (escrowLine (escrowRelease escrowActive true MilestoneStatus.submitted false 1 400))
  emit "escrow.cancel.conserves" "true"
    (escrowLine (escrowCancel escrowActive true))
  emit "escrow.expire.conserves" "100"
    (escrowLine (escrowExpire escrowActive 100))
  emit "escrow.arbitrate.conserves" "2,5000,true"
    (escrowLine (escrowArbitrate { escrowActive with
      status := EscrowStatus.disputed, nonce := 1, total := 600, purse := 600 }
      2 5000 true))
  emit "escrow.arbitrate.replay" "1,5000,true"
    (escrowLine (escrowArbitrate { escrowActive with
      status := EscrowStatus.disputed, nonce := 1 } 1 5000 true))
  emit "escrow.arbitrate.bps" "2,10001,true"
    (escrowLine (escrowArbitrate { escrowActive with
      status := EscrowStatus.disputed, nonce := 1 } 2 10001 true))

  emit "article.submit.ok" "true,9"
    (articleLine (articleSubmit articleDraft true 9))
  emit "article.submit.not_author" "false,9"
    (articleLine (articleSubmit articleDraft false 9))
  emit "article.approve.requires_kasset" "true"
    (articleLine (articleApprove { articleDraft with
      status := ArticleStatus.submitted, requireKAsset := true } true))
  emit "article.publish.ok" "true"
    (articleLine (articlePublish articleApproved true))
  emit "article.publish.not_approved" "true"
    (articleLine (articlePublish articleDraft true))
  emit "article.correct.append_only" "published"
    (articleLine (articleCorrect { articleApproved with
      status := ArticleStatus.published, publishedContentHash := some 9 } true correction))
  emit "article.retract.appends" "published"
    (articleLine (articleRetract { articleApproved with
      status := ArticleStatus.published, publishedContentHash := some 9 } true 2))
  emit "article.attachKnowledge.published" "published"
    (okNone (articleAttachKnowledge { articleApproved with
      status := ArticleStatus.published } true 1))
  emit "article.attest.ok" "true,submitted"
    (articleAttestLine (articleAttest articleSubmitted true attestation1))
  emit "article.attest.role" "false"
    (articleAttestLine (articleAttest articleSubmitted false attestation1))
  emit "article.attest.draft" "draft"
    (articleAttestLine (articleAttest articleDraft true attestation1))
  emit "article.attest.cap" "16"
    (articleAttestLine (articleAttest articleFull true attestation1))

  emit "cover.attach.ok" "active,insured,asset"
    (coverLine (coverAttach coverBase 21 coverPolicy))
  emit "cover.attach.proposed" "proposed"
    (coverLine (coverAttach { coverBase with proposalStatus := ProposalStatus.proposed }
      21 coverPolicy))
  emit "cover.attach.funded" "funded"
    (coverLine (coverAttach { coverBase with proposalStatus := ProposalStatus.funded }
      21 coverPolicy))
  emit "cover.attach.inactive" "inactive"
    (coverLine (coverAttach coverBase 21
      { coverPolicy with status := CoverFactStatus.inactive }))
  emit "cover.attach.insured" "wrong insured"
    (coverLine (coverAttach coverBase 21 { coverPolicy with insured := 8 }))
  emit "cover.attach.asset" "wrong asset"
    (coverLine (coverAttach coverBase 21 { coverPolicy with assetId := 8 }))
  emit "cover.attach.replay" "same"
    (coverLine (coverAttach { coverBase with coverUri := some 21 } 21 coverPolicy))
  emit "cover.attach.overwrite" "different"
    (coverLine (coverAttach { coverBase with coverUri := some 20 } 21 coverPolicy))

  emit "knowledge.attach.ok" "validated chain"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact claimFact provenanceFact credentialFact 50))
  emit "knowledge.attach.published" "published"
    (knowledgeLine (knowledgeAttach { knowledgeBase with
      status := ArticleStatus.published } 11 12 13 14
      kassetFact claimFact provenanceFact credentialFact 50))
  emit "knowledge.attach.draft" "draft"
    (knowledgeLine (knowledgeAttach { knowledgeBase with
      status := ArticleStatus.draft } 11 12 13 14
      kassetFact claimFact provenanceFact credentialFact 50))
  emit "knowledge.attach.kasset_claim" "wrong claim ref"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      { kassetFact with claimUri := 99 } claimFact provenanceFact credentialFact 50))
  emit "knowledge.attach.claim_kasset" "wrong kasset ref"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact { claimFact with kassetUri := 99 } provenanceFact credentialFact 50))
  emit "knowledge.attach.claim_status" "open"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact { claimFact with status := ClaimFactStatus.open }
      provenanceFact credentialFact 50))
  emit "knowledge.attach.provenance_asset" "wrong asset"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact claimFact { provenanceFact with assetUri := 99 } credentialFact 50))
  emit "knowledge.attach.provenance_claim" "wrong claim"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact claimFact { provenanceFact with claimUri := 99 } credentialFact 50))
  emit "knowledge.attach.provenance_hash" "hash mismatch"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact claimFact { provenanceFact with hashOk := false } credentialFact 50))
  emit "knowledge.attach.author" "not an author"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact { claimFact with claimant := 4 }
      { provenanceFact with writers := [4] } credentialFact 50))
  emit "knowledge.attach.credential" "revoked"
    (knowledgeLine (knowledgeAttach knowledgeBase 11 12 13 14
      kassetFact claimFact provenanceFact
      (some { uri := 14, subject := 3, status := CredentialFactStatus.revoked,
              expiresAt := 0 }) 50))
  emit "knowledge.attach.replay" "same"
    (knowledgeLine (knowledgeAttach { knowledgeBase with
      kassetUri := some 11,
      claimUri := some 12,
      provenanceUri := some 13,
      credentialUri := some 14,
      knowledgeAtHeight := 40 } 11 12 13 14
      kassetFact claimFact provenanceFact credentialFact 50))

  emit "edition.append.ok" "published,same"
    (editionLine (editionAppend editionDraft true 1 ArticleStatus.published 1 1 9))
  emit "edition.append.unpublished" "draft,same"
    (editionLine (editionAppend editionDraft true 1 ArticleStatus.draft 1 1 9))
  emit "edition.append.other_publication" "published,other"
    (editionLine (editionAppend editionDraft true 2 ArticleStatus.published 1 1 9))
  emit "edition.append.duplicate" "published,same,dup"
    (editionLine (editionAppend { editionDraft with articles := [entry] } true 1
      ArticleStatus.published 1 1 9))
  emit "edition.seal.ok" "1,7,true"
    (editionLine (editionSeal { editionDraft with articles := [entry] } true 1 7 true))
  emit "edition.seal.empty" "1,7,true"
    (editionLine (editionSeal editionDraft true 1 7 true))
  emit "edition.seal.bad_signature" "1,7,false"
    (editionLine (editionSeal { editionDraft with articles := [entry] } true 1 7 false))
  emit "edition.sealed.append" "sealed"
    (editionLine (editionAppend { editionDraft with status := EditionStatus.sealed } true
      1 ArticleStatus.published 1 1 9))

end Emit
end RPrint

#eval RPrint.Emit.main
