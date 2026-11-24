import RPrint.Basic
import RPrint.Model.Publication

/-!
# Coordination record

A coordination record anchors an off-chain quantum-os room/poll outcome. Creation
binds a publication, a subject and a fixed signer set; recording binds the poll
and outcome hashes with one signature per signer. The record is terminal: the
first outcome wins and a different outcome is refused.

The record is provenance, not authority. `coordinationRecordWithPublication`
returns the publication unchanged, which is the shallow-model form of invariant
I18. Room ids, poll ids and outcome hashes are `Id`s; authority, id, clock,
codec, verifier, membership and signature checks are `Bool` parameters. This is
not a Rholang refinement and it does not prove a room or poll existed.
-/

namespace RPrint

inductive CoordinationStatus where
  | open | recorded
  deriving DecidableEq, Repr

structure CoordinationState where
  coordinationId : Id
  publicationId : Id
  status : CoordinationStatus
  roomIdHash : Id
  pollIdHash : Option Id
  outcomeHash : Option Id
  signers : List Id
  signatures : List Id
  deriving DecidableEq, Repr

/-- The conjunction of the record arm's non-state checks. -/
def coordinationRecordChecks (s : CoordinationState) (callerAuthorized : Bool)
    (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) : Bool :=
  callerAuthorized && idOk && !(poll = 0) && !(outcome = 0) &&
    (sigCount = s.signers.length) && signerOk && sigOk && verifierOk &&
    codecOk && clockOk

def coordinationRecord (s : CoordinationState) (callerAuthorized : Bool)
    (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) : Option CoordinationState :=
  if !coordinationRecordChecks s callerAuthorized idOk clockOk codecOk verifierOk
      signerOk sigOk poll outcome sigCount then none
  else if s.status = CoordinationStatus.recorded then
    if s.pollIdHash = some poll ∧ s.outcomeHash = some outcome then some s
    else none
  else
    some { s with
      status := CoordinationStatus.recorded,
      pollIdHash := some poll,
      outcomeHash := some outcome,
      signatures := s.signers }

/-- I18: recording an outcome leaves the publication state untouched. -/
def coordinationRecordWithPublication (p : PublicationState) (s : CoordinationState)
    (callerAuthorized : Bool)
    (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) : Option (PublicationState × CoordinationState) :=
  match coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk
      signerOk sigOk poll outcome sigCount with
  | none => none
  | some s' => some (p, s')

theorem coordination_record_preserves_publication (p : PublicationState)
    (s : CoordinationState) (callerAuthorized : Bool)
    (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) (p' : PublicationState)
    (s' : CoordinationState)
    (h : coordinationRecordWithPublication p s callerAuthorized idOk clockOk codecOk
          verifierOk signerOk sigOk poll outcome sigCount = some (p', s')) : p' = p := by
  unfold coordinationRecordWithPublication at h
  split at h
  · simp at h
  · simp at h
    exact h.1.symm

theorem coordination_record_requires_authorized (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) (h : callerAuthorized = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, h]

theorem coordination_record_requires_id (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (h : idOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, h]

theorem coordination_record_requires_poll (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (h : poll = 0) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, h]

theorem coordination_record_requires_outcome (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (h : outcome = 0) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, h]

theorem coordination_record_requires_sig_count (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (h : sigCount ≠ s.signers.length) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, h]

theorem coordination_record_requires_signers (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (hc : sigCount = s.signers.length)
    (h : signerOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, hc, h]

theorem coordination_record_requires_signature (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (hc : sigCount = s.signers.length)
    (hs : signerOk = true) (h : sigOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, hc, hs, h]

theorem coordination_record_requires_verifier (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (hc : sigCount = s.signers.length)
    (hs : signerOk = true) (hg : sigOk = true) (h : verifierOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, hc, hs, hg, h]

theorem coordination_record_requires_codec (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (hc : sigCount = s.signers.length)
    (hs : signerOk = true) (hg : sigOk = true) (hv : verifierOk = true)
    (h : codecOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, hc, hs, hg, hv, h]

theorem coordination_record_requires_clock (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat)
    (ha : callerAuthorized = true) (hi : idOk = true) (hp : poll ≠ 0)
    (ho : outcome ≠ 0) (hc : sigCount = s.signers.length)
    (hs : signerOk = true) (hg : sigOk = true) (hv : verifierOk = true)
    (hcd : codecOk = true) (h : clockOk = false) :
    coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk sigOk
      poll outcome sigCount = none := by
  simp [coordinationRecord, coordinationRecordChecks, ha, hi, hp, ho, hc, hs, hg, hv, hcd, h]

theorem coordination_record_result (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) (s' : CoordinationState)
    (h : coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk
          sigOk poll outcome sigCount = some s') :
    s' = { s with
            status := CoordinationStatus.recorded,
            pollIdHash := some poll,
            outcomeHash := some outcome,
            signatures := s.signers } ∨
      (s.status = CoordinationStatus.recorded ∧ s.pollIdHash = some poll ∧
        s.outcomeHash = some outcome ∧ s' = s) := by
  by_cases hc : coordinationRecordChecks s callerAuthorized idOk clockOk codecOk
      verifierOk signerOk sigOk poll outcome sigCount = true
  · have hcf : (!coordinationRecordChecks s callerAuthorized idOk clockOk codecOk
        verifierOk signerOk sigOk poll outcome sigCount) = false := by simp [hc]
    simp [coordinationRecord, hcf] at h
    by_cases hs : s.status = CoordinationStatus.recorded
    · by_cases hp : s.pollIdHash = some poll ∧ s.outcomeHash = some outcome
      · simp [hs, hp] at h
        exact Or.inr ⟨hs, hp.1, hp.2, h.symm⟩
      · simp [hs, hp] at h
    · simp [hs] at h
      exact Or.inl h.symm
  · have hcf : (!coordinationRecordChecks s callerAuthorized idOk clockOk codecOk
        verifierOk signerOk sigOk poll outcome sigCount) = true := by simp [hc]
    simp [coordinationRecord, hcf] at h

theorem coordination_record_binds_outcome (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) (s' : CoordinationState)
    (h : coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk
          sigOk poll outcome sigCount = some s') :
    s'.status = CoordinationStatus.recorded ∧ s'.pollIdHash = some poll ∧
      s'.outcomeHash = some outcome := by
  rcases coordination_record_result s callerAuthorized idOk clockOk codecOk verifierOk
    signerOk sigOk poll outcome sigCount s' h with hcase | ⟨hs, hps, hos, hcase⟩
  · subst s'
    exact ⟨rfl, rfl, rfl⟩
  · subst s'
    exact ⟨hs, hps, hos⟩

theorem coordination_record_preserves_room (s : CoordinationState)
    (callerAuthorized : Bool) (idOk clockOk codecOk verifierOk signerOk sigOk : Bool)
    (poll outcome : Id) (sigCount : Nat) (s' : CoordinationState)
    (h : coordinationRecord s callerAuthorized idOk clockOk codecOk verifierOk signerOk
          sigOk poll outcome sigCount = some s') :
    s'.coordinationId = s.coordinationId ∧ s'.publicationId = s.publicationId ∧
      s'.roomIdHash = s.roomIdHash ∧ s'.signers = s.signers := by
  rcases coordination_record_result s callerAuthorized idOk clockOk codecOk verifierOk
    signerOk sigOk poll outcome sigCount s' h with hcase | ⟨_, _, _, hcase⟩
  · subst s'
    simp
  · subst s'
    simp

theorem coordination_record_replay (s : CoordinationState) (poll outcome : Id)
    (hp : poll ≠ 0) (ho : outcome ≠ 0)
    (hs : s.status = CoordinationStatus.recorded)
    (hps : s.pollIdHash = some poll) (hos : s.outcomeHash = some outcome) :
    coordinationRecord s true true true true true true true poll outcome
      s.signers.length = some s := by
  simp [coordinationRecord, coordinationRecordChecks, hp, ho, hs, hps, hos]

theorem coordination_record_record_conflict_refused (s : CoordinationState)
    (poll outcome outcome2 : Id)
    (hp : poll ≠ 0) (ho2 : outcome2 ≠ 0)
    (hs : s.status = CoordinationStatus.recorded)
    (hps : s.pollIdHash = some poll) (hos : s.outcomeHash = some outcome)
    (hdiff : outcome2 ≠ outcome) :
    coordinationRecord s true true true true true true true poll outcome2
      s.signers.length = none := by
  have hdiff' : outcome ≠ outcome2 := fun h => hdiff h.symm
  simp [coordinationRecord, coordinationRecordChecks, hp, ho2, hs, hps, hos, hdiff']

/-! ## Factory creation

The factory's canonical, subject, room, signer, role, status, clock and cell
checks are Bool atoms in the shallow guard model; id reuse is the modelled state
check. -/

def coordinationFactoryChecks (authorized coordinationOk publicationOk subjectOk
    roomOk signersOk roleOk statusOk clockOk cellOk : Bool) : Bool :=
  authorized && coordinationOk && publicationOk && subjectOk && roomOk &&
    signersOk && roleOk && statusOk && clockOk && cellOk

def coordinationFactoryCreate (s : FactoryState) (id : Id)
    (authorized coordinationOk publicationOk subjectOk roomOk signersOk roleOk
      statusOk clockOk cellOk : Bool) : Option FactoryState :=
  if !coordinationFactoryChecks authorized coordinationOk publicationOk subjectOk
      roomOk signersOk roleOk statusOk clockOk cellOk then none
  else if id ∈ s.issued then none
  else some { s with issued := id :: s.issued }

theorem coordination_factory_create_refuses_reuse (s : FactoryState) (id : Id)
    (authorized coordinationOk publicationOk subjectOk roomOk signersOk roleOk
      statusOk clockOk cellOk : Bool)
    (ha : authorized = true) (hc : coordinationOk = true)
    (hp : publicationOk = true) (hsu : subjectOk = true) (hr : roomOk = true)
    (hs : signersOk = true) (hro : roleOk = true) (ht : statusOk = true)
    (hcl : clockOk = true) (hce : cellOk = true) (h : id ∈ s.issued) :
    coordinationFactoryCreate s id authorized coordinationOk publicationOk subjectOk
      roomOk signersOk roleOk statusOk clockOk cellOk = none := by
  simp [coordinationFactoryCreate, coordinationFactoryChecks,
    ha, hc, hp, hsu, hr, hs, hro, ht, hcl, hce, h]

end RPrint
