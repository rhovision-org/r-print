import RPrint.Basic

/-!
# Publication authority

A publication owns one state cell: a charter hash, a roster keyed by derived
REV address, a publisher count, an admin set and an arbitration fallback.

The model is shallow. A member key is an `Id`, not a key derivation; a DID is an
anchor, not a proof. `publishers` is maintained alongside the roster because the
last-publisher guard is the authority invariant that matters.

Transitions return `Option PublicationState`; `none` is a refusal. Refusal
reason strings are not modelled.
-/

namespace RPrint

inductive Role where
  | publisher | editor | writer | factchecker | treasurer | contributor
  deriving DecidableEq, Repr

inductive MemberStatus where
  | active | removed
  deriving DecidableEq, Repr

structure Member where
  role : Role
  status : MemberStatus
  didHash : Id
  attestationHash : Id
  deriving DecidableEq, Repr

inductive PubStatus where
  | active | paused
  deriving DecidableEq, Repr

structure PublicationState where
  publicationId : Id
  status : PubStatus
  members : List (Id × Member)
  publishers : Nat
  admins : List Id
  threshold : Nat
  arbitrators : List Id
  arbitrationThreshold : Nat
  maxMembers : Nat
  nonce : Nat
  treasury : Id
  charterHash : Id
  deriving DecidableEq, Repr

def isPublisherRole (r : Role) : Bool := r == Role.publisher

def findMember : List (Id × Member) → Id → Option Member
  | [], _ => none
  | (k, v) :: rest, id => if k = id then some v else findMember rest id

def setMember : List (Id × Member) → Id → Member → List (Id × Member)
  | [], id, m => [(id, m)]
  | (k, v) :: rest, id, m =>
      if k = id then (id, m) :: rest else (k, v) :: setMember rest id m

theorem findMember_setMember_same (xs : List (Id × Member)) (id : Id) (m : Member) :
    findMember (setMember xs id m) id = some m := by
  induction xs with
  | nil => simp [setMember, findMember]
  | cons kv rest ih =>
      obtain ⟨k, v⟩ := kv
      by_cases h : k = id
      · simp [setMember, findMember, h]
      · simp [setMember, findMember, h, ih]

theorem findMember_setMember_other (xs : List (Id × Member)) (target id : Id)
    (m : Member) (h : id ≠ target) :
    findMember (setMember xs target m) id = findMember xs id := by
  induction xs with
  | nil =>
      have hti : target ≠ id := fun hc => h hc.symm
      simp [setMember, findMember, hti]
  | cons kv rest ih =>
      obtain ⟨k, v⟩ := kv
      by_cases hk : k = target
      · have hki : k ≠ id := by
          intro hc
          exact h (hc.symm.trans hk)
        have htid : target ≠ id := by
          intro hc
          exact hki (hk.trans hc)
        simp [setMember, findMember, hk, hki, htid]
      · by_cases hki : k = id
        · simp [setMember, findMember, hk, hki, h]
        · simp [setMember, findMember, hk, hki, ih]

def memberActive (s : PublicationState) (id : Id) : Bool :=
  match findMember s.members id with
  | some m => m.status == MemberStatus.active
  | none => false

def isPublisher (s : PublicationState) (id : Id) : Bool :=
  match findMember s.members id with
  | some m => isPublisherRole m.role && (m.status == MemberStatus.active)
  | none => false

theorem isPublisher_setMember_other (s : PublicationState) (target id : Id)
    (m : Member) (h : id ≠ target) :
    isPublisher { s with members := setMember s.members target m } id =
      isPublisher s id := by
  unfold isPublisher
  rw [findMember_setMember_other _ _ _ _ h]

def publicationSafe (s : PublicationState) : Prop := 0 < s.publishers

def publicationAddMember (s : PublicationState) (caller id : Id) (role : Role)
    (didHash attestationHash : Id) : Option PublicationState :=
  if !isPublisher s caller then none
  else if s.members.length ≥ s.maxMembers then none
  else if (findMember s.members id).isSome then none
  else
    some { s with
      members := setMember s.members id
        { role := role, status := MemberStatus.active, didHash := didHash,
          attestationHash := attestationHash },
      publishers := if isPublisherRole role then s.publishers + 1 else s.publishers }

def publicationRemoveMember (s : PublicationState) (caller target : Id) :
    Option PublicationState :=
  if !isPublisher s caller then none
  else if isPublisher s target && s.publishers ≤ 1 then none
  else
    some { s with
      members := setMember s.members target
        (match findMember s.members target with
         | some m => { m with status := MemberStatus.removed }
         | none => { role := Role.contributor, status := MemberStatus.removed,
                     didHash := 0, attestationHash := 0 }),
      publishers := if isPublisher s target then s.publishers - 1 else s.publishers }

theorem publication_addMember_result (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) (s' : PublicationState)
    (h : publicationAddMember s caller id role didHash attestationHash = some s') :
    s' = { s with
      members := setMember s.members id
        { role := role, status := MemberStatus.active, didHash := didHash,
          attestationHash := attestationHash },
      publishers := if isPublisherRole role then s.publishers + 1 else s.publishers } := by
  unfold publicationAddMember at h
  split at h
  · simp at h
  · split at h
    · simp at h
    · split at h
      · simp at h
      · simp at h
        exact h.symm

theorem publication_removeMember_result (s : PublicationState) (caller target : Id)
    (s' : PublicationState) (h : publicationRemoveMember s caller target = some s') :
    s' = { s with
      members := setMember s.members target
        (match findMember s.members target with
         | some m => { m with status := MemberStatus.removed }
         | none => { role := Role.contributor, status := MemberStatus.removed,
                     didHash := 0, attestationHash := 0 }),
      publishers := if isPublisher s target then s.publishers - 1 else s.publishers } := by
  unfold publicationRemoveMember at h
  by_cases hp : (!isPublisher s caller) = true
  · simp [publicationRemoveMember, hp] at h
  · by_cases hlast : (isPublisher s target && s.publishers ≤ 1) = true
    · simp [publicationRemoveMember, hp, hlast] at h
    · simp [publicationRemoveMember, hp, hlast] at h
      exact h.symm

def publicationSetRole (s : PublicationState) (caller target : Id) (role : Role) :
    Option PublicationState :=
  if !isPublisher s caller then none
  else if isPublisher s target && !isPublisherRole role && s.publishers ≤ 1 then none
  else
    some { s with
      members := setMember s.members target
        (match findMember s.members target with
         | some m => { m with role := role }
         | none => { role := role, status := MemberStatus.active,
                     didHash := 0, attestationHash := 0 }),
      publishers :=
        if isPublisher s target && !isPublisherRole role then s.publishers - 1
        else if !isPublisher s target && isPublisherRole role then s.publishers + 1
        else s.publishers }

def publicationAttestSelf (s : PublicationState) (caller didHash attestationHash : Id) :
    Option PublicationState :=
  if !memberActive s caller then none
  else
    some { s with
      members := setMember s.members caller
        (match findMember s.members caller with
         | some m => { m with didHash := didHash, attestationHash := attestationHash }
         | none => { role := Role.contributor, status := MemberStatus.active,
                     didHash := didHash, attestationHash := attestationHash }) }

/-- I17: a self-attestation anchor changes only DID fields, never authority. -/
theorem publication_attest_preserves_authority (s : PublicationState)
    (caller didHash attestationHash : Id) (s' : PublicationState)
    (h : publicationAttestSelf s caller didHash attestationHash = some s') :
    isPublisher s' caller = isPublisher s caller ∧
      memberActive s' caller = memberActive s caller := by
  unfold publicationAttestSelf at h
  by_cases ha : memberActive s caller = true
  · simp [ha] at h
    cases h
    unfold isPublisher memberActive
    cases hf : findMember s.members caller with
    | none => simp [memberActive, hf] at ha
    | some m => simp [hf, setMember, findMember_setMember_same]
  · have haf : memberActive s caller = false := by simpa using ha
    simp [haf] at h

def publicationPause (s : PublicationState) (caller : Id) (paused : Bool) :
    Option PublicationState :=
  if !isPublisher s caller then none
  else some { s with status := if paused then PubStatus.paused else PubStatus.active }

inductive AdminAction where
  | pause | resume
  | setAdmins (keys : List Id)
  | setThreshold (n : Nat)
  | setTreasury (id : Id)
  deriving DecidableEq, Repr

def publicationAdmin (s : PublicationState) (nonce : Nat) (action : AdminAction)
    (authorized : Bool) : Option PublicationState :=
  if nonce ≤ s.nonce then none
  else if !authorized then none
  else
    match action with
    | AdminAction.pause => some { s with status := PubStatus.paused, nonce := nonce }
    | AdminAction.resume => some { s with status := PubStatus.active, nonce := nonce }
    | AdminAction.setAdmins keys =>
        if keys.length ≥ 2 then some { s with admins := keys, nonce := nonce } else none
    | AdminAction.setThreshold n =>
        if n ≥ 1 then some { s with threshold := n, nonce := nonce } else none
    | AdminAction.setTreasury id => some { s with treasury := id, nonce := nonce }

inductive ArbSource where
  | arbitrators | admins | platform
  deriving DecidableEq, Repr

structure Arbitration where
  source : ArbSource
  keys : List Id
  threshold : Nat
  deriving DecidableEq, Repr

def publicationArbitration (platformKeys : List Id) (platformThreshold : Nat)
    (s : PublicationState) : Arbitration :=
  if s.arbitrators.length > 0 then
    { source := ArbSource.arbitrators, keys := s.arbitrators,
      threshold := s.arbitrationThreshold }
  else if s.admins.length ≥ 2 then
    { source := ArbSource.admins, keys := s.admins, threshold := s.threshold }
  else
    { source := ArbSource.platform, keys := platformKeys, threshold := platformThreshold }

/-! ## Arm obligations -/

theorem publication_addMember_requires_publisher (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) (h : isPublisher s caller = false) :
    publicationAddMember s caller id role didHash attestationHash = none := by
  simp [publicationAddMember, h]

theorem publication_addMember_respects_cap (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) (hp : isPublisher s caller = true)
    (hcap : s.members.length ≥ s.maxMembers) :
    publicationAddMember s caller id role didHash attestationHash = none := by
  simp [publicationAddMember, hp, hcap]

theorem publication_addMember_refuses_duplicate (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) (hp : isPublisher s caller = true)
    (hdup : (findMember s.members id).isSome = true) :
    publicationAddMember s caller id role didHash attestationHash = none := by
  by_cases hcap : s.members.length ≥ s.maxMembers
  · simp [publicationAddMember, hp, hcap]
  · simp [publicationAddMember, hp, hcap, hdup]

theorem publication_removeMember_requires_publisher (s : PublicationState) (caller target : Id)
    (h : isPublisher s caller = false) : publicationRemoveMember s caller target = none := by
  simp [publicationRemoveMember, h]

theorem publication_removeMember_refuses_last_publisher (s : PublicationState)
    (caller target : Id) (hp : isPublisher s target = true) (hcount : s.publishers ≤ 1) :
    publicationRemoveMember s caller target = none := by
  by_cases hc : isPublisher s caller = true
  · simp [publicationRemoveMember, hc, hp, hcount]
  · have hcf : isPublisher s caller = false := by simpa using hc
    simp [publicationRemoveMember, hcf]

theorem publication_setRole_requires_publisher (s : PublicationState) (caller target : Id)
    (role : Role) (h : isPublisher s caller = false) :
    publicationSetRole s caller target role = none := by
  simp [publicationSetRole, h]

theorem publication_setRole_refuses_last_publisher (s : PublicationState)
    (caller target : Id) (role : Role) (hp : isPublisher s target = true)
    (hrole : isPublisherRole role = false) (hcount : s.publishers ≤ 1) :
    publicationSetRole s caller target role = none := by
  by_cases hc : isPublisher s caller = true
  · simp [publicationSetRole, hc, hp, hrole, hcount]
  · have hcf : isPublisher s caller = false := by simpa using hc
    simp [publicationSetRole, hcf]

theorem publication_attestSelf_requires_member (s : PublicationState) (caller didHash
    attestationHash : Id) (h : memberActive s caller = false) :
    publicationAttestSelf s caller didHash attestationHash = none := by
  simp [publicationAttestSelf, h]

theorem publication_pause_requires_publisher (s : PublicationState) (caller : Id)
    (paused : Bool) (h : isPublisher s caller = false) :
    publicationPause s caller paused = none := by
  simp [publicationPause, h]

theorem publication_pause_sets_paused (s : PublicationState) (caller : Id)
    (hp : isPublisher s caller = true) :
    ∃ s', publicationPause s caller true = some s' ∧ s'.status = PubStatus.paused := by
  refine ⟨{ s with status := PubStatus.paused }, ?_, rfl⟩
  simp [publicationPause, hp]

theorem publication_pause_resumes (s : PublicationState) (caller : Id)
    (hp : isPublisher s caller = true) :
    ∃ s', publicationPause s caller false = some s' ∧ s'.status = PubStatus.active := by
  refine ⟨{ s with status := PubStatus.active }, ?_, rfl⟩
  simp [publicationPause, hp]

theorem publication_admin_replay_refused (s : PublicationState) (nonce : Nat)
    (action : AdminAction) (authorized : Bool) (h : nonce ≤ s.nonce) :
    publicationAdmin s nonce action authorized = none := by
  simp [publicationAdmin, h]

theorem publication_admin_requires_authorization (s : PublicationState) (nonce : Nat)
    (action : AdminAction) (h : authorized = false) :
    publicationAdmin s nonce action authorized = none := by
  by_cases hreplay : nonce ≤ s.nonce
  · simp [publicationAdmin, hreplay]
  · simp [publicationAdmin, hreplay, h]

theorem publication_admin_setAdmins_requires_valid (s : PublicationState) (nonce : Nat)
    (keys : List Id) (authorized : Bool) (h : keys.length < 2) :
    publicationAdmin s nonce (AdminAction.setAdmins keys) authorized = none := by
  by_cases hreplay : nonce ≤ s.nonce
  · simp [publicationAdmin, hreplay]
  · by_cases hauth : authorized = true
    · simp [publicationAdmin, hreplay, hauth, h]
    · have hauthf : authorized = false := by simpa using hauth
      simp [publicationAdmin, hreplay, hauthf]

theorem publication_arbitration_prefers_arbitrators (platformKeys : List Id)
    (platformThreshold : Nat) (s : PublicationState) (h : s.arbitrators.length > 0) :
    (publicationArbitration platformKeys platformThreshold s).source =
      ArbSource.arbitrators := by
  simp [publicationArbitration, h]

theorem publication_arbitration_admin_fallback (platformKeys : List Id)
    (platformThreshold : Nat) (s : PublicationState) (h1 : s.arbitrators.length = 0)
    (h2 : s.admins.length ≥ 2) :
    (publicationArbitration platformKeys platformThreshold s).source =
      ArbSource.admins := by
  simp [publicationArbitration, h1, h2]

theorem publication_solo_arbitration_platform (platformKeys : List Id)
    (platformThreshold : Nat) (s : PublicationState) (h1 : s.arbitrators.length = 0)
    (h2 : ¬ s.admins.length ≥ 2) :
    (publicationArbitration platformKeys platformThreshold s).source =
      ArbSource.platform := by
  simp [publicationArbitration, h1, h2]

/-! ## Safety preservation -/

theorem publication_addMember_safe (s : PublicationState) (caller id : Id) (role : Role)
    (didHash attestationHash : Id) (hs : publicationSafe s)
    (h : publicationAddMember s caller id role didHash attestationHash = some s') :
    publicationSafe s' := by
  unfold publicationAddMember at h
  split at h
  · simp at h
  · split at h
    · simp at h
    · split at h
      · simp at h
      · simp at h
        subst s'
        unfold publicationSafe at hs ⊢
        by_cases hr : isPublisherRole role = true
        · simp [hr]
        · have hrf : isPublisherRole role = false := by simpa using hr
          simp [hrf]
          exact hs

theorem publication_attestSelf_safe (s : PublicationState) (caller didHash
    attestationHash : Id) (hs : publicationSafe s)
    (h : publicationAttestSelf s caller didHash attestationHash = some s') :
    publicationSafe s' := by
  unfold publicationAttestSelf at h
  split at h
  · simp at h
  · simp at h
    subst s'
    exact hs

theorem publication_pause_safe (s : PublicationState) (caller : Id) (paused : Bool)
    (hs : publicationSafe s) (h : publicationPause s caller paused = some s') :
    publicationSafe s' := by
  unfold publicationPause at h
  split at h
  · simp at h
  · simp at h
    subst s'
    exact hs

end RPrint
