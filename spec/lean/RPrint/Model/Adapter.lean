import RPrint.Model.Commission
import RPrint.Model.Article

/-!
# Sibling adapter ties

The r-sure cover and the r-gen knowledge chain are optional surfaces. The deployed
contracts verify a set of sibling facts before they record a link; this module models
those checks as shallow state machines.

A policy is an opaque `PolicyFact`; a K-Asset, Claim, Provenance and Credential are
opaque facts. The model proves the guards and the single-assignment rule, not the
sibling contracts themselves. Refusal reason strings are not modelled.
-/

namespace RPrint

/-! ## r-sure cover -/

inductive CoverFactStatus where
  | active | inactive
  deriving DecidableEq, Repr

structure PolicyFact where
  status : CoverFactStatus
  insured : Id
  assetId : Id
  perClaimLimit : Amount
  aggregateRemaining : Amount
  deriving DecidableEq, Repr

structure CoverState where
  proposalId : Id
  proposalStatus : ProposalStatus
  treasury : Id
  assetId : Id
  coverUri : Option Id
  coverStatus : Option CoverFactStatus
  coverAssetId : Option Id
  coverPerClaimLimit : Option Amount
  coverAggregateRemaining : Option Amount
  coverInsured : Option Id
  deriving DecidableEq, Repr

def coverOk (s : CoverState) (p : PolicyFact) : Bool :=
  (p.status == CoverFactStatus.active) && (p.insured == s.treasury) &&
    (p.assetId == s.assetId)

def coverOpen (s : CoverState) : Bool :=
  s.proposalStatus == ProposalStatus.proposed ||
    s.proposalStatus == ProposalStatus.accepted

def coverAttach (s : CoverState) (uri : Id) (p : PolicyFact) : Option CoverState :=
  if !coverOpen s then none
  else
    match s.coverUri with
    | some u => if u = uri then some s else none
    | none =>
        if coverOk s p then
          some { s with
            coverUri := some uri
            coverStatus := some p.status
            coverAssetId := some p.assetId
            coverPerClaimLimit := some p.perClaimLimit
            coverAggregateRemaining := some p.aggregateRemaining
            coverInsured := some p.insured }
        else none

def coverAttachSystem (s : CoverState) (e : EscrowState) (uri : Id)
    (p : PolicyFact) : Option (CoverState × EscrowState) :=
  match coverAttach s uri p with
  | none => none
  | some s' => some (s', e)

theorem cover_attach_requires_open_proposal (s : CoverState) (uri : Id) (p : PolicyFact)
    (h : s.proposalStatus ≠ ProposalStatus.proposed)
    (h2 : s.proposalStatus ≠ ProposalStatus.accepted) :
    coverAttach s uri p = none := by
  have ho : coverOpen s = false := by
    simp [coverOpen, h, h2]
  simp [coverAttach, ho]

theorem cover_attach_requires_active_policy (s : CoverState) (uri : Id) (p : PolicyFact)
    (huri : s.coverUri = none) (h : p.status ≠ CoverFactStatus.active) :
    coverAttach s uri p = none := by
  cases hcov : coverOpen s with
  | false => simp [coverAttach, hcov]
  | true => simp [coverAttach, hcov, coverOk, huri, h]

theorem cover_attach_requires_insured (s : CoverState) (uri : Id) (p : PolicyFact)
    (huri : s.coverUri = none) (hactive : p.status = CoverFactStatus.active)
    (h : p.insured ≠ s.treasury) :
    coverAttach s uri p = none := by
  cases hcov : coverOpen s with
  | false => simp [coverAttach, hcov]
  | true => simp [coverAttach, hcov, coverOk, huri, hactive, h]

theorem cover_attach_requires_asset (s : CoverState) (uri : Id) (p : PolicyFact)
    (huri : s.coverUri = none) (hactive : p.status = CoverFactStatus.active)
    (hins : p.insured = s.treasury) (h : p.assetId ≠ s.assetId) :
    coverAttach s uri p = none := by
  cases hcov : coverOpen s with
  | false => simp [coverAttach, hcov]
  | true => simp [coverAttach, hcov, coverOk, huri, hactive, hins, h]

theorem cover_attach_single_assignment (s : CoverState) (uri u : Id) (p : PolicyFact)
    (huri : s.coverUri = some u) (h : u ≠ uri) :
    coverAttach s uri p = none := by
  cases hcov : coverOpen s with
  | false => simp [coverAttach, hcov]
  | true => simp [coverAttach, hcov, huri, h]

theorem cover_attach_replay (s : CoverState) (uri : Id) (p : PolicyFact)
    (hopen : coverOpen s = true) (huri : s.coverUri = some uri) :
    coverAttach s uri p = some s := by
  simp [coverAttach, hopen, huri]

theorem cover_attach_preserves_status (s : CoverState) (uri : Id) (p : PolicyFact)
    (s' : CoverState) (h : coverAttach s uri p = some s') :
    s'.proposalStatus = s.proposalStatus := by
  unfold coverAttach at h
  cases hcov : coverOpen s with
  | false => simp [hcov] at h
  | true =>
      simp [hcov] at h
      cases hc : s.coverUri with
      | some u =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          rfl
      | none =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          rfl

theorem cover_attachSystem_escrow (s : CoverState) (e : EscrowState) (uri : Id)
    (p : PolicyFact) (s' : CoverState) (e' : EscrowState)
    (h : coverAttachSystem s e uri p = some (s', e')) : e' = e := by
  unfold coverAttachSystem at h
  cases hc : coverAttach s uri p with
  | none => simp [hc] at h
  | some s0 =>
      simp [hc] at h
      simp_all

theorem cover_attach_preserves_conservation (s : CoverState) (e : EscrowState)
    (uri : Id) (p : PolicyFact) (s' : CoverState) (e' : EscrowState)
    (hc : escrowConserves e)
    (h : coverAttachSystem s e uri p = some (s', e')) :
    escrowConserves e' := by
  rw [cover_attachSystem_escrow s e uri p s' e' h]
  exact hc

/-! ## r-gen knowledge chain -/

inductive ClaimFactStatus where
  | open | validated | conditional | rejected | withdrawn | expired
  deriving DecidableEq, Repr

structure KAssetFact where
  uri : Id
  claimUri : Id
  deriving DecidableEq, Repr

structure ClaimFact where
  uri : Id
  kassetUri : Id
  status : ClaimFactStatus
  claimant : Id
  deriving DecidableEq, Repr

structure ProvenanceFact where
  uri : Id
  assetUri : Id
  claimUri : Id
  writers : List Id
  hashOk : Bool
  deriving DecidableEq, Repr

inductive CredentialFactStatus where
  | active | revoked
  deriving DecidableEq, Repr

structure CredentialFact where
  uri : Id
  subject : Id
  status : CredentialFactStatus
  expiresAt : Height
  deriving DecidableEq, Repr

structure KnowledgeState where
  articleId : Id
  status : ArticleStatus
  contentHash : Id
  authors : List Id
  kassetUri : Option Id
  claimUri : Option Id
  provenanceUri : Option Id
  credentialUri : Option Id
  knowledgeAtHeight : Height
  deriving DecidableEq, Repr

def hasId : List Id → Id → Bool
  | [], _ => false
  | x :: xs, id => if x = id then true else hasId xs id

def anyWriterAuthor : List Id → List Id → Bool
  | [], _ => false
  | w :: ws, authors => if hasId authors w then true else anyWriterAuthor ws authors

def authorLink (claimant : Id) (writers authors : List Id) : Bool :=
  hasId authors claimant || anyWriterAuthor writers authors

def matchedAuthor (claimant : Id) (writers authors : List Id) : Id :=
  if hasId authors claimant then claimant
  else match writers with
    | [] => 0
    | w :: ws => if hasId authors w then w else matchedAuthor claimant ws authors

def credentialActive (a : Id) (f : CredentialFact) (now : Height) : Bool :=
  (f.subject == a) && (f.status == CredentialFactStatus.active) &&
    (f.expiresAt == 0 || now ≤ f.expiresAt)

def credentialOk (cred : Id) (a : Id) (cf : Option CredentialFact)
    (now : Height) : Bool :=
  cred == 0 || match cf with
    | none => false
    | some f => credentialActive a f now

def knowledgeAttachable (st : ArticleStatus) : Bool :=
  st == ArticleStatus.submitted || st == ArticleStatus.approved

def credOption (cred : Id) : Option Id :=
  if cred = 0 then none else some cred

def sameKnowledge (s : KnowledgeState) (kasset claim prov cred : Id) : Bool :=
  s.kassetUri == some kasset && s.claimUri == some claim &&
    s.provenanceUri == some prov && s.credentialUri == credOption cred

def knowledgeAssign (s : KnowledgeState) (kasset claim prov cred : Id)
    (now : Height) : KnowledgeState :=
  { s with
    kassetUri := some kasset
    claimUri := some claim
    provenanceUri := some prov
    credentialUri := credOption cred
    knowledgeAtHeight := now }

def knowledgeFactsOk (s : KnowledgeState) (kasset claim _prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) : Bool :=
  (k.claimUri == claim) && (c.kassetUri == kasset) &&
    (c.status == ClaimFactStatus.validated || c.status == ClaimFactStatus.conditional) &&
    (p.assetUri == kasset) && (p.claimUri == claim) && p.hashOk &&
    authorLink c.claimant p.writers s.authors &&
    credentialOk cred (matchedAuthor c.claimant p.writers s.authors) cf now

def knowledgeAttach (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) : Option KnowledgeState :=
  if !knowledgeAttachable s.status then none
  else if kasset == 0 || claim == 0 || prov == 0 then none
  else match s.kassetUri with
    | some _ => if sameKnowledge s kasset claim prov cred then some s else none
    | none =>
        if knowledgeFactsOk s kasset claim prov cred k c p cf now then
          some (knowledgeAssign s kasset claim prov cred now)
        else none

def knowledgeAttachGuard (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) : Bool :=
  knowledgeAttachable s.status && !(kasset == 0 || claim == 0 || prov == 0) &&
    match s.kassetUri with
    | some _ => sameKnowledge s kasset claim prov cred
    | none => knowledgeFactsOk s kasset claim prov cred k c p cf now

theorem knowledgeAttach_guard_eq (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) :
    (knowledgeAttach s kasset claim prov cred k c p cf now).isSome =
      knowledgeAttachGuard s kasset claim prov cred k c p cf now := by
  unfold knowledgeAttach knowledgeAttachGuard
  cases hs : knowledgeAttachable s.status with
  | false => simp [hs]
  | true =>
      cases hz : (kasset == 0 || claim == 0 || prov == 0) with
      | true => simp [hs, hz]
      | false =>
          cases hk : s.kassetUri with
          | some u =>
              cases hsk : sameKnowledge s kasset claim prov cred <;>
                simp [hs, hz, hk, hsk]
          | none =>
              cases hfk : knowledgeFactsOk s kasset claim prov cred k c p cf now <;>
                simp [hs, hz, hk, hfk]

theorem knowledge_attach_refuses_published (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (h : s.status = ArticleStatus.published) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeAttachable, h]

theorem knowledge_attach_refuses_draft (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (h : s.status = ArticleStatus.draft) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeAttachable, h]

theorem knowledge_attach_requires_kasset_claim (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (h : k.claimUri ≠ claim) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, h]

theorem knowledge_attach_requires_claim_kasset (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (h : c.kassetUri ≠ kasset) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, h]

theorem knowledge_attach_requires_claim_status (s : KnowledgeState) (kasset claim prov cred : Id)
    (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hs1 : c.status ≠ ClaimFactStatus.validated)
    (hs2 : c.status ≠ ClaimFactStatus.conditional) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hs1, hs2]

theorem knowledge_attach_requires_provenance_asset (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hcs : c.status = ClaimFactStatus.validated)
    (h : p.assetUri ≠ kasset) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hcs, h]

theorem knowledge_attach_requires_provenance_claim (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hcs : c.status = ClaimFactStatus.validated)
    (hpa : p.assetUri = kasset) (h : p.claimUri ≠ claim) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hcs, hpa, h]

theorem knowledge_attach_requires_provenance_hash (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hcs : c.status = ClaimFactStatus.validated)
    (hpa : p.assetUri = kasset) (hpc : p.claimUri = claim)
    (h : p.hashOk = false) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hcs, hpa, hpc, h]

theorem knowledge_attach_requires_author (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hcs : c.status = ClaimFactStatus.validated)
    (hpa : p.assetUri = kasset) (hpc : p.claimUri = claim)
    (hh : p.hashOk = true) (h : authorLink c.claimant p.writers s.authors = false) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hcs, hpa, hpc, hh, h]

theorem knowledge_attach_requires_credential (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = none)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (hkc : k.claimUri = claim) (hck : c.kassetUri = kasset)
    (hcs : c.status = ClaimFactStatus.validated)
    (hpa : p.assetUri = kasset) (hpc : p.claimUri = claim)
    (hh : p.hashOk = true) (ha : authorLink c.claimant p.writers s.authors = true)
    (h : credentialOk cred (matchedAuthor c.claimant p.writers s.authors) cf now = false) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, hkc, hck, hcs, hpa, hpc, hh, ha, h]

theorem knowledge_attach_single_assignment (s : KnowledgeState)
    (kasset claim prov cred u : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = some u)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (h : sameKnowledge s kasset claim prov cred = false) :
    knowledgeAttach s kasset claim prov cred k c p cf now = none := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, h]

theorem knowledge_attach_replay (s : KnowledgeState)
    (kasset claim prov cred u : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height)
    (hstatus : knowledgeAttachable s.status = true) (huri : s.kassetUri = some u)
    (hk : kasset ≠ 0) (hc : claim ≠ 0) (hp : prov ≠ 0)
    (h : sameKnowledge s kasset claim prov cred = true) :
    knowledgeAttach s kasset claim prov cred k c p cf now = some s := by
  simp [knowledgeAttach, knowledgeFactsOk, hstatus, huri, hk, hc, hp, h]

theorem knowledge_attach_preserves_status (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) (s' : KnowledgeState)
    (h : knowledgeAttach s kasset claim prov cred k c p cf now = some s') :
    s'.status = s.status := by
  unfold knowledgeAttach at h
  split at h
  · simp at h
  · split at h
    · simp at h
    · cases hc : s.kassetUri with
      | some u =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          rfl
      | none =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          simp [knowledgeAssign]

theorem knowledge_attach_preserves_hash (s : KnowledgeState)
    (kasset claim prov cred : Id) (k : KAssetFact) (c : ClaimFact) (p : ProvenanceFact)
    (cf : Option CredentialFact) (now : Height) (s' : KnowledgeState)
    (h : knowledgeAttach s kasset claim prov cred k c p cf now = some s') :
    s'.contentHash = s.contentHash := by
  unfold knowledgeAttach at h
  split at h
  · simp at h
  · split at h
    · simp at h
    · cases hc : s.kassetUri with
      | some u =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          rfl
      | none =>
          simp [hc] at h
          obtain ⟨_, hs⟩ := h
          cases hs
          simp [knowledgeAssign]

end RPrint
