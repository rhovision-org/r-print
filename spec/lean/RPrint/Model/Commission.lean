import RPrint.Basic

/-!
# Commission proposal and escrow

A proposal is the editorial contract: a writer proposes, an editor accepts, and
anyone may fund the accepted proposal. Funding creates an escrow with a total,
a milestone list and a purse.

The escrow is the money state machine. A milestone moves `pending → submitted →
released`; release pays the writer and refuses out-of-order or double release.
`cancel`, `expire` and `resolveDispute` refund the remaining purse. `dispute`
freezes the escrow; `arbitrate` splits the remaining purse by basis points.

The shallow model keeps milestone guards as parameters (`mStatus`, `priorReleased`)
and models the money exactly. Conservation is
`paidWriter + refundedFunder + purse = total` at every transition. Refusal
reason strings are not modelled.
-/

namespace RPrint

inductive ProposalStatus where
  | proposed | accepted | funded | cancelled
  deriving DecidableEq, Repr

inductive MilestoneStatus where
  | pending | submitted | released
  deriving DecidableEq, Repr

structure Milestone where
  milestoneId : Id
  amount : Amount
  status : MilestoneStatus
  deadline : Height
  evidenceHash : Id
  deriving DecidableEq, Repr

structure ProposalState where
  proposalId : Id
  writerId : Id
  editorId : Option Id
  funderId : Option Id
  status : ProposalStatus
  total : Amount
  milestones : List Milestone
  deriving DecidableEq, Repr

inductive EscrowStatus where
  | active | completed | cancelled | disputed | arbitrated | expired
  deriving DecidableEq, Repr

structure EscrowState where
  escrowId : Id
  status : EscrowStatus
  total : Amount
  paidWriter : Amount
  refundedFunder : Amount
  purse : Amount
  milestones : List Milestone
  graceBlocks : Nat
  disputeWindowBlocks : Nat
  hardDeadline : Height
  disputeAt : Option Height
  nonce : Nat
  deriving DecidableEq, Repr

def setMilestoneStatus : List Milestone → Id → MilestoneStatus → List Milestone
  | [], _, _ => []
  | m :: rest, id, st =>
      if m.milestoneId = id then { m with status := st } :: rest
      else m :: setMilestoneStatus rest id st

def escrowTerminal : EscrowStatus → Bool
  | EscrowStatus.completed | EscrowStatus.cancelled | EscrowStatus.arbitrated
  | EscrowStatus.expired => true
  | _ => false

def escrowConserves (s : EscrowState) : Prop :=
  s.paidWriter + s.refundedFunder + s.purse = s.total

def escrowSafe (s : EscrowState) : Prop :=
  escrowConserves s ∧ (escrowTerminal s.status = true → s.purse = 0)

def escrowRemaining (s : EscrowState) : Amount :=
  s.total - s.paidWriter - s.refundedFunder

/-! ## Proposal transitions -/

def commissionPropose (proposalId caller : Id) (callerIsWriter : Bool)
    (total : Amount) (milestones : List Milestone) : Option ProposalState :=
  if !callerIsWriter then none
  else
    some { proposalId := proposalId, writerId := caller, editorId := none,
           funderId := none, status := ProposalStatus.proposed, total := total,
           milestones := milestones }

theorem commission_propose_requires_writer (proposalId caller : Id)
    (callerIsWriter : Bool) (total : Amount) (milestones : List Milestone)
    (h : callerIsWriter = false) :
    commissionPropose proposalId caller callerIsWriter total milestones = none := by
  simp [commissionPropose, h]

theorem commission_propose_initial (proposalId caller : Id) (callerIsWriter : Bool)
    (total : Amount) (milestones : List Milestone) (p : ProposalState)
    (h : commissionPropose proposalId caller callerIsWriter total milestones = some p) :
    p.status = ProposalStatus.proposed := by
  unfold commissionPropose at h
  split at h
  · simp at h
  · simp at h
    subst p
    rfl

def commissionAccept (p : ProposalState) (caller : Id) (isEditor : Bool) :
    Option ProposalState :=
  if !isEditor then none
  else if p.status = ProposalStatus.proposed then
    some { p with status := ProposalStatus.accepted, editorId := some caller }
  else none

theorem commission_accept_requires_proposed (p : ProposalState) (caller : Id)
    (isEditor : Bool) (h : p.status ≠ ProposalStatus.proposed) :
    commissionAccept p caller isEditor = none := by
  by_cases he : isEditor = true
  · simp [commissionAccept, he, h]
  · have hef : isEditor = false := by simpa using he
    simp [commissionAccept, hef]

theorem commission_accept_requires_editor (p : ProposalState) (caller : Id)
    (isEditor : Bool) (h : isEditor = false) :
    commissionAccept p caller isEditor = none := by
  simp [commissionAccept, h]

theorem commission_accept_sets_editor (p : ProposalState) (caller : Id)
    (isEditor : Bool) (p' : ProposalState)
    (h : commissionAccept p caller isEditor = some p') :
    p'.editorId = some caller := by
  unfold commissionAccept at h
  split at h
  · simp at h
  · split at h
    · simp at h
      subst p'
      rfl
    · simp at h

def escrowOfProposal (p : ProposalState) (_funderId : Id) : EscrowState :=
  { escrowId := p.proposalId, status := EscrowStatus.active, total := p.total,
    paidWriter := 0, refundedFunder := 0, purse := p.total,
    milestones := p.milestones, graceBlocks := 0, disputeWindowBlocks := 0,
    hardDeadline := 0, disputeAt := none, nonce := 0 }

def commissionFund (p : ProposalState) (funder : Id) (isEditor : Bool) :
    Option (ProposalState × EscrowState) :=
  if !isEditor then none
  else if p.status = ProposalStatus.accepted then
    some ({ p with status := ProposalStatus.funded, funderId := some funder },
          escrowOfProposal p funder)
  else none

theorem commission_fund_requires_accepted (p : ProposalState) (funder : Id)
    (isEditor : Bool) (h : p.status ≠ ProposalStatus.accepted) :
    commissionFund p funder isEditor = none := by
  by_cases he : isEditor = true
  · simp [commissionFund, he, h]
  · have hef : isEditor = false := by simpa using he
    simp [commissionFund, hef]

theorem commission_fund_requires_editor (p : ProposalState) (funder : Id)
    (isEditor : Bool) (h : isEditor = false) :
    commissionFund p funder isEditor = none := by
  simp [commissionFund, h]

theorem commission_fund_creates_active_escrow (p : ProposalState) (funder : Id)
    (isEditor : Bool) (p' : ProposalState) (e : EscrowState)
    (h : commissionFund p funder isEditor = some (p', e)) :
    e.status = EscrowStatus.active ∧ e.total = p.total ∧ e.purse = p.total := by
  unfold commissionFund at h
  split at h
  · simp at h
  · split at h
    · simp at h
      rcases h with ⟨rfl, rfl⟩
      simp [escrowOfProposal]
    · simp at h

def commissionCancel (p : ProposalState) (authorized : Bool) : Option ProposalState :=
  if !authorized then none
  else if p.status = ProposalStatus.proposed ∨ p.status = ProposalStatus.accepted then
    some { p with status := ProposalStatus.cancelled }
  else none

theorem commission_cancel_requires_writer_or_editor (p : ProposalState)
    (authorized : Bool) (h : authorized = false) :
    commissionCancel p authorized = none := by
  simp [commissionCancel, h]

/-! ## Escrow transitions -/

def escrowSubmit (s : EscrowState) (callerIsWriter : Bool) (mStatus : MilestoneStatus)
    (milestoneId : Id) (now deadline : Height) : Option EscrowState :=
  if !callerIsWriter then none
  else if s.status = EscrowStatus.active then
    if mStatus = MilestoneStatus.pending then
      if now ≤ deadline + s.graceBlocks then
        some { s with milestones :=
          setMilestoneStatus s.milestones milestoneId MilestoneStatus.submitted }
      else none
    else none
  else none

theorem escrow_submit_requires_writer (s : EscrowState) (callerIsWriter : Bool)
    (mStatus : MilestoneStatus) (milestoneId : Id) (now deadline : Height)
    (h : callerIsWriter = false) :
    escrowSubmit s callerIsWriter mStatus milestoneId now deadline = none := by
  simp [escrowSubmit, h]

theorem escrow_submit_requires_active (s : EscrowState) (callerIsWriter : Bool)
    (mStatus : MilestoneStatus) (milestoneId : Id) (now deadline : Height)
    (h : s.status ≠ EscrowStatus.active) :
    escrowSubmit s callerIsWriter mStatus milestoneId now deadline = none := by
  by_cases hw : callerIsWriter = true
  · simp [escrowSubmit, hw, h]
  · have hwf : callerIsWriter = false := by simpa using hw
    simp [escrowSubmit, hwf]

theorem escrow_submit_requires_pending (s : EscrowState) (callerIsWriter : Bool)
    (mStatus : MilestoneStatus) (milestoneId : Id) (now deadline : Height)
    (h : mStatus ≠ MilestoneStatus.pending) :
    escrowSubmit s callerIsWriter mStatus milestoneId now deadline = none := by
  by_cases hw : callerIsWriter = true
  · by_cases ha : s.status = EscrowStatus.active
    · simp [escrowSubmit, hw, ha, h]
    · simp [escrowSubmit, hw, ha]
  · have hwf : callerIsWriter = false := by simpa using hw
    simp [escrowSubmit, hwf]

theorem escrow_submit_refuses_too_late (s : EscrowState) (callerIsWriter : Bool)
    (mStatus : MilestoneStatus) (milestoneId : Id) (now deadline : Height)
    (hw : callerIsWriter = true) (ha : s.status = EscrowStatus.active)
    (hp : mStatus = MilestoneStatus.pending) (h : ¬ now ≤ deadline + s.graceBlocks) :
    escrowSubmit s callerIsWriter mStatus milestoneId now deadline = none := by
  simp [escrowSubmit, hw, ha, hp, h]

def escrowRelease (s : EscrowState) (callerIsEditor : Bool) (mStatus : MilestoneStatus)
    (priorReleased : Bool) (milestoneId : Id) (amount : Amount) : Option EscrowState :=
  if !callerIsEditor then none
  else if s.status = EscrowStatus.active then
    if mStatus = MilestoneStatus.submitted then
      if priorReleased then
        if amount ≤ s.purse then
          some { s with
            paidWriter := s.paidWriter + amount,
            purse := s.purse - amount,
            milestones := setMilestoneStatus s.milestones milestoneId
              MilestoneStatus.released }
        else none
      else none
    else none
  else none

theorem escrow_release_requires_editor (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (h : callerIsEditor = false) :
    escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = none := by
  simp [escrowRelease, h]

theorem escrow_release_requires_active (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (h : s.status ≠ EscrowStatus.active) :
    escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = none := by
  by_cases he : callerIsEditor = true
  · simp [escrowRelease, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [escrowRelease, hef]

theorem escrow_release_requires_submitted (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (h : mStatus ≠ MilestoneStatus.submitted) :
    escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = none := by
  by_cases he : callerIsEditor = true
  · by_cases ha : s.status = EscrowStatus.active
    · simp [escrowRelease, he, ha, h]
    · simp [escrowRelease, he, ha]
  · have hef : callerIsEditor = false := by simpa using he
    simp [escrowRelease, hef]

theorem escrow_release_pays_once (s : EscrowState) (callerIsEditor : Bool)
    (priorReleased : Bool) (milestoneId : Id) (amount : Amount) :
    escrowRelease s callerIsEditor MilestoneStatus.released priorReleased milestoneId amount
      = none := by
  have h : MilestoneStatus.released ≠ MilestoneStatus.submitted := by decide
  exact escrow_release_requires_submitted s callerIsEditor MilestoneStatus.released
    priorReleased milestoneId amount h

theorem escrow_release_requires_prior (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (h : priorReleased = false) :
    escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = none := by
  by_cases he : callerIsEditor = true
  · by_cases ha : s.status = EscrowStatus.active
    · by_cases hm : mStatus = MilestoneStatus.submitted
      · simp [escrowRelease, he, ha, hm, h]
      · simp [escrowRelease, he, ha, hm]
    · simp [escrowRelease, he, ha]
  · have hef : callerIsEditor = false := by simpa using he
    simp [escrowRelease, hef]

theorem escrow_release_bounded_by_purse (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (h : ¬ amount ≤ s.purse) :
    escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = none := by
  by_cases he : callerIsEditor = true
  · by_cases ha : s.status = EscrowStatus.active
    · by_cases hm : mStatus = MilestoneStatus.submitted
      · by_cases hp : priorReleased = true
        · simp [escrowRelease, he, ha, hm, hp, h]
        · have hpf : priorReleased = false := by simpa using hp
          simp [escrowRelease, he, ha, hm, hpf]
      · simp [escrowRelease, he, ha, hm]
    · simp [escrowRelease, he, ha]
  · have hef : callerIsEditor = false := by simpa using he
    simp [escrowRelease, hef]

theorem escrow_release_conserves (s : EscrowState) (callerIsEditor : Bool)
    (mStatus : MilestoneStatus) (priorReleased : Bool) (milestoneId : Id)
    (amount : Amount) (hs : escrowConserves s)
    (h : escrowRelease s callerIsEditor mStatus priorReleased milestoneId amount = some s') :
    escrowConserves s' := by
  by_cases he : callerIsEditor = true
  · by_cases ha : s.status = EscrowStatus.active
    · by_cases hm : mStatus = MilestoneStatus.submitted
      · by_cases hp : priorReleased = true
        · by_cases hb : amount ≤ s.purse
          · simp [escrowRelease, he, ha, hm, hp, hb] at h
            cases h
            simp [escrowConserves] at hs ⊢
            have hsplit : amount + (s.purse - amount) = s.purse :=
              Nat.add_sub_of_le hb
            simp only [Amount] at hs hb hsplit ⊢
            omega
          · simp [escrowRelease, he, ha, hm, hp, hb] at h
        · have hpf : priorReleased = false := by simpa using hp
          simp [escrowRelease, he, ha, hm, hpf] at h
      · simp [escrowRelease, he, ha, hm] at h
    · simp [escrowRelease, he, ha] at h
  · have hef : callerIsEditor = false := by simpa using he
    simp [escrowRelease, hef] at h

def escrowCancel (s : EscrowState) (callerAuthorized : Bool) : Option EscrowState :=
  if !callerAuthorized then none
  else if s.status = EscrowStatus.active then
    some { s with
      status := EscrowStatus.cancelled,
      refundedFunder := s.refundedFunder + s.purse,
      purse := 0 }
  else none

theorem escrow_cancel_requires_role_or_funder (s : EscrowState)
    (callerAuthorized : Bool) (h : callerAuthorized = false) :
    escrowCancel s callerAuthorized = none := by
  simp [escrowCancel, h]

theorem escrow_cancel_refunds_remaining (s : EscrowState) (callerAuthorized : Bool)
    (s' : EscrowState) (h : escrowCancel s callerAuthorized = some s') :
    s'.purse = 0 ∧ s'.refundedFunder = s.refundedFunder + s.purse := by
  unfold escrowCancel at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      simp
    · simp at h

theorem escrow_cancel_conserves (s : EscrowState) (callerAuthorized : Bool)
    (hs : escrowConserves s)
    (h : escrowCancel s callerAuthorized = some s') : escrowConserves s' := by
  by_cases hc : callerAuthorized = true
  · by_cases ha : s.status = EscrowStatus.active
    · simp [escrowCancel, hc, ha] at h
      cases h
      simp [escrowConserves] at hs ⊢
      simp only [Amount] at hs ⊢
      omega
    · simp [escrowCancel, hc, ha] at h
  · have hcf : callerAuthorized = false := by simpa using hc
    simp [escrowCancel, hcf] at h

def escrowDispute (s : EscrowState) (callerAuthorized : Bool) (now : Height) :
    Option EscrowState :=
  if !callerAuthorized then none
  else if s.status = EscrowStatus.active then
    some { s with status := EscrowStatus.disputed, disputeAt := some now }
  else none

theorem escrow_dispute_requires_writer_or_funder (s : EscrowState)
    (callerAuthorized : Bool) (now : Height) (h : callerAuthorized = false) :
    escrowDispute s callerAuthorized now = none := by
  simp [escrowDispute, h]

theorem escrow_dispute_only_active (s : EscrowState) (callerAuthorized : Bool)
    (now : Height) (h : s.status ≠ EscrowStatus.active) :
    escrowDispute s callerAuthorized now = none := by
  by_cases hc : callerAuthorized = true
  · simp [escrowDispute, hc, h]
  · have hcf : callerAuthorized = false := by simpa using hc
    simp [escrowDispute, hcf]

def escrowArbitrate (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) : Option EscrowState :=
  if s.status = EscrowStatus.disputed then
    if nonce ≤ s.nonce then none
    else if !authorized then none
    else if writerBps > Bps then none
    else
      some { s with
        status := EscrowStatus.arbitrated,
        paidWriter := s.paidWriter + shareOf s.purse writerBps,
        refundedFunder := s.refundedFunder + (s.purse - shareOf s.purse writerBps),
        purse := 0, nonce := nonce }
  else none

theorem escrow_arbitrate_only_disputed (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) (h : s.status ≠ EscrowStatus.disputed) :
    escrowArbitrate s nonce writerBps authorized = none := by
  unfold escrowArbitrate
  rw [if_neg h]

theorem escrow_arbitrate_replay_refused (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) (hs : s.status = EscrowStatus.disputed) (h : nonce ≤ s.nonce) :
    escrowArbitrate s nonce writerBps authorized = none := by
  simp [escrowArbitrate, hs, h]

theorem escrow_arbitrate_bps_bounded (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) (hs : s.status = EscrowStatus.disputed)
    (hreplay : ¬ nonce ≤ s.nonce) (h : writerBps > Bps) :
    escrowArbitrate s nonce writerBps authorized = none := by
  by_cases ha : authorized = true
  · simp [escrowArbitrate, hs, hreplay, ha, h]
  · have haf : authorized = false := by simpa using ha
    simp [escrowArbitrate, hs, hreplay, haf]

theorem escrow_arbitrate_shares_sum (purse bps : Nat) (h : bps ≤ Bps) :
    shareOf purse bps + (purse - shareOf purse bps) = purse := by
  exact Nat.add_sub_of_le (shareOf_le h)

theorem escrow_arbitrate_conserves (s : EscrowState) (nonce : Nat) (writerBps : Nat)
    (authorized : Bool) (hs : escrowConserves s)
    (h : escrowArbitrate s nonce writerBps authorized = some s') :
    escrowConserves s' := by
  by_cases hd : s.status = EscrowStatus.disputed
  · by_cases hr : nonce ≤ s.nonce
    · simp [escrowArbitrate, hd, hr] at h
    · by_cases ha : authorized = true
      · by_cases hb : writerBps > Bps
        · simp [escrowArbitrate, hd, hr, ha, hb] at h
        · simp [escrowArbitrate, hd, hr, ha, hb] at h
          cases h
          simp [escrowConserves] at hs ⊢
          have hshare : shareOf s.purse writerBps ≤ s.purse := shareOf_le (by omega)
          have hsplit :
              shareOf s.purse writerBps + (s.purse - shareOf s.purse writerBps) =
                s.purse := Nat.add_sub_of_le hshare
          simp only [Amount] at hs hshare hsplit ⊢
          omega
      · have haf : authorized = false := by simpa using ha
        simp [escrowArbitrate, hd, hr, haf] at h
  · simp [escrowArbitrate, hd] at h

def escrowResolveDispute (s : EscrowState) (now : Height) : Option EscrowState :=
  if s.status = EscrowStatus.disputed then
    match s.disputeAt with
    | some disputeHeight =>
        if now ≥ disputeHeight + s.disputeWindowBlocks then
          some { s with
            status := EscrowStatus.expired,
            refundedFunder := s.refundedFunder + s.purse,
            purse := 0 }
        else none
    | none => none
  else none

theorem escrow_resolveDispute_too_early_refused (s : EscrowState) (now disputeHeight : Height)
    (hs : s.status = EscrowStatus.disputed) (hd : s.disputeAt = some disputeHeight)
    (h : now < disputeHeight + s.disputeWindowBlocks) :
    escrowResolveDispute s now = none := by
  have hlt : ¬ now ≥ disputeHeight + s.disputeWindowBlocks := by
    simp only [Height] at h ⊢
    omega
  simp [escrowResolveDispute, hs, hd, hlt]

theorem escrow_resolveDispute_conserves (s : EscrowState) (now : Height)
    (hs : escrowConserves s) (h : escrowResolveDispute s now = some s') :
    escrowConserves s' := by
  unfold escrowResolveDispute at h
  split at h
  · split at h
    · split at h
      · simp at h
        cases h
        simp [escrowConserves] at hs ⊢
        simp only [Amount] at hs ⊢
        omega
      · simp at h
    · simp at h
  · simp at h

def escrowExpire (s : EscrowState) (now : Height) : Option EscrowState :=
  if s.status = EscrowStatus.active then
    if now ≥ s.hardDeadline then
      some { s with
        status := EscrowStatus.expired,
        refundedFunder := s.refundedFunder + s.purse,
        purse := 0 }
    else none
  else none

theorem escrow_expire_too_early_refused (s : EscrowState) (now : Height)
    (ha : s.status = EscrowStatus.active) (h : now < s.hardDeadline) :
    escrowExpire s now = none := by
  have hlt : ¬ now ≥ s.hardDeadline := by
    simp only [Height] at h ⊢
    omega
  simp [escrowExpire, ha, hlt]

theorem escrow_expire_conserves (s : EscrowState) (now : Height)
    (hs : escrowConserves s) (h : escrowExpire s now = some s') :
    escrowConserves s' := by
  by_cases ha : s.status = EscrowStatus.active
  · by_cases ht : now ≥ s.hardDeadline
    · simp [escrowExpire, ha, ht] at h
      cases h
      simp [escrowConserves] at hs ⊢
      simp only [Amount] at hs ⊢
      omega
    · simp [escrowExpire, ha, ht] at h
  · simp [escrowExpire, ha] at h

/-! ## Global escrow obligations -/

theorem escrow_remaining_eq_purse (s : EscrowState) (hs : escrowConserves s) :
    escrowRemaining s = s.purse := by
  unfold escrowRemaining
  simp [escrowConserves] at hs
  simp only [Amount] at hs ⊢
  omega

theorem escrow_terminal_conserved (s : EscrowState) (hs : escrowSafe s)
    (ht : escrowTerminal s.status = true) :
    s.paidWriter + s.refundedFunder = s.total := by
  unfold escrowSafe at hs
  rcases hs with ⟨hc, hz⟩
  have h0 : s.purse = 0 := hz ht
  simp [escrowConserves] at hc
  simp only [Amount] at hc h0 ⊢
  omega

end RPrint
