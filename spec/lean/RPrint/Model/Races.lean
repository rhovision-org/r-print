import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition

/-!
# Arm-pair race matrix

Pair obligations over the shallow model. `exclusive` means the second arm
refuses after the first commits; `ordered` records the admitted direction and
the refused reverse; `independent` records disjoint writes. This is not
scheduler-level race freedom and not a refinement of the deployed Rholang.
-/

set_option linter.unusedVariables false

namespace RPrint

/-! ## Status lemmas -/

theorem commission_accept_sets_accepted (p : ProposalState) (caller : Id)
    (isEditor : Bool) (p' : ProposalState)
    (h : commissionAccept p caller isEditor = some p') :
    p'.status = ProposalStatus.accepted := by
  unfold commissionAccept at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

theorem commission_fund_sets_funded (p : ProposalState) (funder : Id)
    (p' : ProposalState) (e : EscrowState)
    (h : commissionFund p funder = some (p', e)) :
    p'.status = ProposalStatus.funded := by
  unfold commissionFund at h
  split at h
  · simp at h
    rcases h with ⟨rfl, rfl⟩
    rfl
  · simp at h

theorem escrow_cancel_sets_cancelled (s : EscrowState) (authorized : Bool)
    (s' : EscrowState) (h : escrowCancel s authorized = some s') :
    s'.status = EscrowStatus.cancelled := by
  unfold escrowCancel at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

theorem escrow_expire_sets_expired (s : EscrowState) (now : Height)
    (s' : EscrowState) (h : escrowExpire s now = some s') :
    s'.status = EscrowStatus.expired := by
  unfold escrowExpire at h
  split at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h
  · simp at h

theorem escrow_arbitrate_sets_arbitrated (s : EscrowState) (nonce writerBps : Nat)
    (authorized : Bool) (s' : EscrowState)
    (h : escrowArbitrate s nonce writerBps authorized = some s') :
    s'.status = EscrowStatus.arbitrated := by
  unfold escrowArbitrate at h
  split at h
  · split at h
    · simp at h
    · split at h
      · simp at h
      · split at h
        · simp at h
        · simp at h
          cases h
          rfl
  · simp at h

theorem article_submit_sets_submitted (s : ArticleState) (callerIsAuthor : Bool)
    (newHash : Id) (s' : ArticleState)
    (h : articleSubmit s callerIsAuthor newHash = some s') :
    s'.status = ArticleStatus.submitted := by
  unfold articleSubmit at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

theorem article_publish_sets_published (s : ArticleState) (callerIsEditor : Bool)
    (s' : ArticleState) (h : articlePublish s callerIsEditor = some s') :
    s'.status = ArticleStatus.published := by
  unfold articlePublish at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

/-! ## Commission proposal pairs -/

theorem commission_accept_accept_never_after (p : ProposalState) (caller : Id)
    (isEditor : Bool) (p' : ProposalState)
    (h : commissionAccept p caller isEditor = some p') :
    commissionAccept p' caller isEditor = none := by
  have hs := commission_accept_sets_accepted p caller isEditor p' h
  exact commission_accept_requires_proposed p' caller isEditor
    (by rw [hs]; intro hc; cases hc)

theorem commission_fund_fund_never_after (p : ProposalState) (funder : Id)
    (p' : ProposalState) (e : EscrowState)
    (h : commissionFund p funder = some (p', e)) :
    commissionFund p' funder = none := by
  have hs := commission_fund_sets_funded p funder p' e h
  exact commission_fund_requires_accepted p' funder
    (by rw [hs]; intro hc; cases hc)

theorem commission_accept_fund_ordered (p : ProposalState) (caller funder : Id)
    (isEditor : Bool)
    (h1 : ∃ p', commissionAccept p caller isEditor = some p') :
    (∃ p', commissionAccept p caller isEditor = some p' ∧
      ∃ p'' e, commissionFund p' funder = some (p'', e)) ∧
    (∀ p' e, commissionFund p funder = some (p', e) →
      commissionAccept p' caller isEditor = none) := by
  rcases h1 with ⟨p1, h1⟩
  have hs := commission_accept_sets_accepted p caller isEditor p1 h1
  constructor
  · exact ⟨p1, h1, commission_fund_any_caller p1 funder (by rw [hs])⟩
  · intro p2 e h2
    have hs2 := commission_fund_sets_funded p funder p2 e h2
    exact commission_accept_requires_proposed p2 caller isEditor
      (by rw [hs2]; intro hc; cases hc)

/-! ## Escrow pairs -/

theorem escrow_cancel_cancel_never_after (s : EscrowState) (authorized : Bool)
    (s' : EscrowState) (h : escrowCancel s authorized = some s') :
    escrowCancel s' authorized = none := by
  have hs := escrow_cancel_sets_cancelled s authorized s' h
  simp [escrowCancel, hs]

theorem escrow_cancel_expire_exclusive (s : EscrowState) (authorized : Bool)
    (now : Height) (s' : EscrowState) (h : escrowCancel s authorized = some s') :
    escrowExpire s' now = none := by
  have hs := escrow_cancel_sets_cancelled s authorized s' h
  simp [escrowExpire, hs]

theorem escrow_cancel_arbitrate_exclusive (s : EscrowState) (authorized : Bool)
    (nonce writerBps : Nat) (s' : EscrowState)
    (h : escrowCancel s authorized = some s') :
    escrowArbitrate s' nonce writerBps authorized = none := by
  have hs := escrow_cancel_sets_cancelled s authorized s' h
  simp [escrowArbitrate, hs]

theorem escrow_expire_expire_never_after (s : EscrowState) (now : Height)
    (s' : EscrowState) (h : escrowExpire s now = some s') :
    escrowExpire s' now = none := by
  have hs := escrow_expire_sets_expired s now s' h
  simp [escrowExpire, hs]

theorem escrow_expire_arbitrate_exclusive (s : EscrowState) (now : Height)
    (nonce writerBps : Nat) (authorized : Bool) (s' : EscrowState)
    (h : escrowExpire s now = some s') :
    escrowArbitrate s' nonce writerBps authorized = none := by
  have hs := escrow_expire_sets_expired s now s' h
  simp [escrowArbitrate, hs]

theorem escrow_arbitrate_arbitrate_never_after (s : EscrowState) (nonce writerBps : Nat)
    (authorized : Bool) (s' : EscrowState)
    (h : escrowArbitrate s nonce writerBps authorized = some s') :
    escrowArbitrate s' nonce writerBps authorized = none := by
  have hs := escrow_arbitrate_sets_arbitrated s nonce writerBps authorized s' h
  simp [escrowArbitrate, hs]

/-! ## Article and edition pairs -/

theorem article_submit_submit_never_after (s : ArticleState) (callerIsAuthor : Bool)
    (newHash : Id) (s' : ArticleState)
    (h : articleSubmit s callerIsAuthor newHash = some s') :
    articleSubmit s' callerIsAuthor newHash = none := by
  have hs := article_submit_sets_submitted s callerIsAuthor newHash s' h
  exact article_submit_requires_draft s' callerIsAuthor newHash
    (by rw [hs]; intro hc; cases hc)

theorem article_publish_publish_never_after (s : ArticleState) (callerIsEditor : Bool)
    (s' : ArticleState) (h : articlePublish s callerIsEditor = some s') :
    articlePublish s' callerIsEditor = none := by
  have hs := article_publish_sets_published s callerIsEditor s' h
  exact article_publish_requires_approved s' callerIsEditor
    (by rw [hs]; intro hc; cases hc)

theorem article_submit_publish_ordered (s : ArticleState) (callerIsAuthor callerIsEditor : Bool)
    (newHash : Id) (h1 : ∃ s', articleSubmit s callerIsAuthor newHash = some s') :
    (∃ s', articleSubmit s callerIsAuthor newHash = some s' ∧
      articlePublish s' callerIsEditor = none) ∧
    (∀ s', articlePublish s callerIsEditor = some s' →
      articleSubmit s' callerIsAuthor newHash = none) := by
  rcases h1 with ⟨s1, h1⟩
  have hs := article_submit_sets_submitted s callerIsAuthor newHash s1 h1
  constructor
  · exact ⟨s1, h1, article_publish_requires_approved s1 callerIsEditor
      (by rw [hs]; intro hc; cases hc)⟩
  · intro s2 h2
    have hs2 := article_publish_sets_published s callerIsEditor s2 h2
    exact article_submit_requires_draft s2 callerIsAuthor newHash
      (by rw [hs2]; intro hc; cases hc)

theorem edition_seal_seal_never_after (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (s' : EditionState)
    (h : editionSeal s callerIsEditor editorId manifestHash sigOk = some s') :
    editionSeal s' callerIsEditor editorId manifestHash sigOk = none := by
  have hs := edition_seal_binds_manifest s callerIsEditor editorId manifestHash sigOk s' h
  exact edition_seal_requires_draft s' callerIsEditor editorId manifestHash sigOk
    (by rw [hs.1]; intro hc; cases hc)

theorem article_submit_correct_ordered (s : ArticleState) (callerIsAuthor callerIsEditor : Bool)
    (newHash : Id) (correction : Correction)
    (h1 : ∃ s', articleSubmit s callerIsAuthor newHash = some s') :
    ∃ s', articleSubmit s callerIsAuthor newHash = some s' ∧
      articleCorrect s' callerIsEditor correction = none := by
  rcases h1 with ⟨s1, h1⟩
  have hs := article_submit_sets_submitted s callerIsAuthor newHash s1 h1
  exact ⟨s1, h1, article_correct_only_published_or_retracted s1 callerIsEditor correction
    (by rw [hs]; intro hc; cases hc) (by rw [hs]; intro hc; cases hc)⟩

theorem edition_append_seal_ordered (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (articlePublication : Id)
    (articleStatus : ArticleStatus) (articleId articleUri contentHash : Id) :
    (∀ s', editionSeal s callerIsEditor editorId manifestHash sigOk = some s' →
      editionAppend s' callerIsEditor articlePublication articleStatus articleId
        articleUri contentHash = none) := by
  intro s' hseal
  have hs := edition_seal_binds_manifest s callerIsEditor editorId manifestHash sigOk s' hseal
  exact edition_append_requires_draft s' callerIsEditor articlePublication articleStatus
    articleId articleUri contentHash (by rw [hs.1]; intro hc; cases hc)

end RPrint
