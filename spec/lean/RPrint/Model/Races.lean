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

theorem escrow_release_release_never_after (s : EscrowState) (callerIsEditor : Bool)
    (priorReleased : Bool) (milestoneId : Id) (m : Milestone)
    (hm : findMilestone s.milestones milestoneId = some m) (s' : EscrowState)
    (h : escrowRelease s callerIsEditor priorReleased milestoneId = some s') :
    escrowRelease s' callerIsEditor priorReleased milestoneId = none :=
  escrow_release_pays_once s callerIsEditor priorReleased milestoneId m hm s' h

theorem escrow_release_cancel_ordered (s : EscrowState) (authorized : Bool)
    (s' : EscrowState) (h : escrowCancel s authorized = some s')
    (callerIsEditor : Bool) (priorReleased : Bool) (milestoneId : Id) :
    escrowRelease s' callerIsEditor priorReleased milestoneId = none := by
  have hs := escrow_cancel_sets_cancelled s authorized s' h
  exact escrow_release_requires_active s' callerIsEditor priorReleased milestoneId
    (by rw [hs]; intro hc; cases hc)

theorem escrow_release_expire_ordered (s : EscrowState) (now : Height)
    (s' : EscrowState) (h : escrowExpire s now = some s')
    (callerIsEditor : Bool) (priorReleased : Bool) (milestoneId : Id) :
    escrowRelease s' callerIsEditor priorReleased milestoneId = none := by
  have hs := escrow_expire_sets_expired s now s' h
  exact escrow_release_requires_active s' callerIsEditor priorReleased milestoneId
    (by rw [hs]; intro hc; cases hc)

theorem escrow_release_arbitrate_exclusive (s : EscrowState) (nonce writerBps : Nat)
    (authorized : Bool) (s' : EscrowState)
    (h : escrowArbitrate s nonce writerBps authorized = some s')
    (callerIsEditor : Bool) (priorReleased : Bool) (milestoneId : Id) :
    escrowRelease s' callerIsEditor priorReleased milestoneId = none := by
  have hs := escrow_arbitrate_sets_arbitrated s nonce writerBps authorized s' h
  exact escrow_release_requires_active s' callerIsEditor priorReleased milestoneId
    (by rw [hs]; intro hc; cases hc)

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

theorem edition_append_success (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (s' : EditionState)
    (h : editionAppend s callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = some s') :
    s' = { s with articles := s.articles ++
      [{ articleId := articleId, articleUri := articleUri, contentHash := contentHash }] } := by
  unfold editionAppend at h
  by_cases hc : callerIsEditor = true
  · by_cases hd : s.status = EditionStatus.draft
    · by_cases hp : articleStatus = ArticleStatus.published
      · by_cases hsame : articlePublication = s.publicationId
        · by_cases hdup : s.articles.any (fun e => e.articleId = articleId) = true
          · simp [hc, hd, hp, hsame, hdup] at h
          · by_cases hcap : s.articles.length ≥ 64
            · simp [hc, hd, hp, hsame, hdup, hcap] at h
            · simp [hc, hd, hp, hsame, hdup, hcap] at h
              cases h
              rw [hd]
        · simp [hc, hd, hp, hsame] at h
      · simp [hc, hd, hp] at h
    · simp [hc, hd] at h
  · simp [hc] at h

theorem edition_append_preserves_status (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (s' : EditionState)
    (h : editionAppend s callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = some s') :
    s'.status = s.status := by
  rw [edition_append_success s callerIsEditor articlePublication articleStatus
    articleId articleUri contentHash s' h]

theorem edition_append_preserves_publication (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (s' : EditionState)
    (h : editionAppend s callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = some s') :
    s'.publicationId = s.publicationId := by
  rw [edition_append_success s callerIsEditor articlePublication articleStatus
    articleId articleUri contentHash s' h]

theorem edition_append_contains_article (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (s' : EditionState)
    (h : editionAppend s callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = some s') :
    s'.articles.any (fun e => e.articleId = articleId) = true := by
  rw [edition_append_success s callerIsEditor articlePublication articleStatus
    articleId articleUri contentHash s' h]
  simp [List.any_append]

theorem edition_append_append_same_never_after (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (s' : EditionState)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (hp : articleStatus = ArticleStatus.published)
    (hsame : articlePublication = s.publicationId)
    (h : editionAppend s callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = some s') :
    editionAppend s' callerIsEditor articlePublication articleStatus articleId
      articleUri contentHash = none := by
  have hs := edition_append_preserves_status s callerIsEditor articlePublication
    articleStatus articleId articleUri contentHash s' h
  have hp' := edition_append_preserves_publication s callerIsEditor articlePublication
    articleStatus articleId articleUri contentHash s' h
  have hdup := edition_append_contains_article s callerIsEditor articlePublication
    articleStatus articleId articleUri contentHash s' h
  exact edition_append_refuses_duplicate s' callerIsEditor articlePublication articleStatus
    articleId articleUri contentHash he (by rw [hs]; exact hd) hp
    (by rw [hp']; exact hsame) hdup

theorem edition_seal_seal_never_after (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (s' : EditionState)
    (h : editionSeal s callerIsEditor editorId manifestHash sigOk = some s') :
    editionSeal s' callerIsEditor editorId manifestHash sigOk = none := by
  have hs := edition_seal_binds_manifest s callerIsEditor editorId manifestHash sigOk s' h
  exact edition_seal_requires_draft s' callerIsEditor editorId manifestHash sigOk
    (by rw [hs.1]; intro hc; cases hc)

/-! ## Publication pairs -/

theorem publication_addMember_addMember_same_never_after (s s1 : PublicationState)
    (caller id : Id) (role : Role) (didHash attestationHash : Id)
    (hne : caller ≠ id)
    (h1 : publicationAddMember s caller id role didHash attestationHash = some s1) :
    publicationAddMember s1 caller id role didHash attestationHash = none := by
  have hp : isPublisher s caller = true := by
    cases h : isPublisher s caller with
    | false =>
        rw [publication_addMember_requires_publisher s caller id role didHash
          attestationHash h] at h1
        cases h1
    | true => rfl
  have hmem : s1.members = setMember s.members id
      { role := role, status := MemberStatus.active, didHash := didHash,
        attestationHash := attestationHash } := by
    rw [publication_addMember_result s caller id role didHash attestationHash s1 h1]
  have hp1 : isPublisher s1 caller = true := by
    unfold isPublisher at hp ⊢
    rw [hmem]
    simp [findMember_setMember_other, hne, hp]
  have hdup : (findMember s1.members id).isSome = true := by
    rw [hmem]
    simp [findMember_setMember_same]
  exact publication_addMember_refuses_duplicate s1 caller id role didHash
    attestationHash hp1 hdup

theorem publication_addMember_removeMember_ordered (s s1 : PublicationState)
    (caller id : Id) (role : Role) (didHash attestationHash : Id)
    (hne : caller ≠ id)
    (h1 : publicationRemoveMember s caller id = some s1) :
    publicationAddMember s1 caller id role didHash attestationHash = none := by
  have hp : isPublisher s caller = true := by
    cases h : isPublisher s caller with
    | false =>
        rw [publication_removeMember_requires_publisher s caller id h] at h1
        cases h1
    | true => rfl
  have hmem : s1.members = setMember s.members id
      (match findMember s.members id with
       | some m => { m with status := MemberStatus.removed }
       | none => { role := Role.contributor, status := MemberStatus.removed,
                   didHash := 0, attestationHash := 0 }) := by
    rw [publication_removeMember_result s caller id s1 h1]
    rfl
  have hp1 : isPublisher s1 caller = true := by
    unfold isPublisher at hp ⊢
    rw [hmem]
    simp [findMember_setMember_other, hne, hp]
  have hdup : (findMember s1.members id).isSome = true := by
    rw [hmem]
    simp [findMember_setMember_same]
  exact publication_addMember_refuses_duplicate s1 caller id role didHash
    attestationHash hp1 hdup

theorem publication_pause_pause_independent (s : PublicationState) (caller : Id)
    (p1 p2 : Bool) (hp : isPublisher s caller = true) :
    ∃ s1 s2, publicationPause s caller p1 = some s1 ∧
      publicationPause s1 caller p2 = some s2 ∧
      s2.status = (if p2 then PubStatus.paused else PubStatus.active) := by
  unfold isPublisher at hp
  let s1 := { s with status := if p1 then PubStatus.paused else PubStatus.active }
  let s2 := { s1 with status := if p2 then PubStatus.paused else PubStatus.active }
  refine ⟨s1, s2, ?_, ?_, ?_⟩
  · simp [s1, publicationPause, isPublisher, hp]
  · simp [s2, s1, publicationPause, isPublisher, hp]
  · simp [s2]

theorem publication_addMember_pause_independent (s : PublicationState) (caller id : Id)
    (role : Role) (didHash attestationHash : Id) (paused : Bool)
    (hp : isPublisher s caller = true)
    (hcap : ¬ s.members.length ≥ s.maxMembers)
    (hdup : (findMember s.members id).isSome = false)
    (hne : caller ≠ id) :
    (∃ s1 s2, publicationAddMember s caller id role didHash attestationHash = some s1 ∧
      publicationPause s1 caller paused = some s2) ∧
    (∃ s1 s2, publicationPause s caller paused = some s1 ∧
      publicationAddMember s1 caller id role didHash attestationHash = some s2) := by
  unfold isPublisher at hp
  let sAdded := { s with
    members := setMember s.members id
      { role := role, status := MemberStatus.active, didHash := didHash,
        attestationHash := attestationHash },
    publishers := if isPublisherRole role then s.publishers + 1 else s.publishers }
  let sAddedPaused := { sAdded with
    status := if paused then PubStatus.paused else PubStatus.active }
  let sPaused := { s with
    status := if paused then PubStatus.paused else PubStatus.active }
  constructor
  · refine ⟨sAdded, sAddedPaused, ?_, ?_⟩
    · simp [sAdded, publicationAddMember, isPublisher, hp, hcap, hdup]
    · simp [sAddedPaused, sAdded, publicationPause, isPublisher,
        findMember_setMember_other, hne, hp]
  · refine ⟨sPaused, sAddedPaused, ?_, ?_⟩
    · simp [sPaused, publicationPause, isPublisher, hp]
    · simp [sAddedPaused, sPaused, sAdded, publicationAddMember, isPublisher,
        hp, hcap, hdup]

theorem publication_removeMember_removeMember_independent (s : PublicationState)
    (caller target : Id) (hp : isPublisher s caller = true)
    (hlast : (isPublisher s target && s.publishers ≤ 1) = false)
    (hne : caller ≠ target)
    (h1 : ∃ s1, publicationRemoveMember s caller target = some s1) :
    ∃ s1, publicationRemoveMember s caller target = some s1 ∧
      (publicationRemoveMember s1 caller target).isSome = true := by
  unfold isPublisher at hp hlast
  rcases h1 with ⟨s1, h1⟩
  refine ⟨s1, h1, ?_⟩
  have hmem : s1.members = setMember s.members target
      (match findMember s.members target with
       | some m => { m with status := MemberStatus.removed }
       | none => { role := Role.contributor, status := MemberStatus.removed,
                   didHash := 0, attestationHash := 0 }) := by
    rw [publication_removeMember_result s caller target s1 h1]
    rfl
  cases hf : findMember s.members target <;>
    simp [publicationRemoveMember, hmem, isPublisher, hf,
      findMember_setMember_other, findMember_setMember_same, hne, hp]

theorem publication_removeMember_pause_independent (s : PublicationState)
    (caller target : Id) (paused : Bool)
    (hp : isPublisher s caller = true)
    (hlast : (isPublisher s target && s.publishers ≤ 1) = false)
    (hne : caller ≠ target)
    (h1 : ∃ s1, publicationRemoveMember s caller target = some s1) :
    (∃ s1, publicationRemoveMember s caller target = some s1 ∧
      (publicationPause s1 caller paused).isSome = true) ∧
    (∃ s1, publicationPause s caller paused = some s1 ∧
      (publicationRemoveMember s1 caller target).isSome = true) := by
  unfold isPublisher at hp hlast
  rcases h1 with ⟨s1, h1⟩
  have hmem : s1.members = setMember s.members target
      (match findMember s.members target with
       | some m => { m with status := MemberStatus.removed }
       | none => { role := Role.contributor, status := MemberStatus.removed,
                   didHash := 0, attestationHash := 0 }) := by
    rw [publication_removeMember_result s caller target s1 h1]
    rfl
  let sPaused := { s with
    status := if paused then PubStatus.paused else PubStatus.active }
  constructor
  · refine ⟨s1, h1, ?_⟩
    simp [publicationPause, hmem, isPublisher, findMember_setMember_other, hne, hp]
  · refine ⟨sPaused, ?_, ?_⟩
    · simp [sPaused, publicationPause, isPublisher, hp]
    · cases hf : findMember s.members target <;>
        simp [sPaused, publicationRemoveMember, isPublisher, hf, hp, hlast]
      intro hrole hstatus
      have hnot : ¬ s.publishers ≤ 1 := by
        simpa [hf, hrole, hstatus] using hlast
      omega

theorem article_correct_status (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (s' : ArticleState)
    (h : articleCorrect s callerIsEditor correction = some s') :
    s.status = ArticleStatus.published ∨ s.status = ArticleStatus.retracted := by
  by_cases he : callerIsEditor = true
  · by_cases hs : s.status = ArticleStatus.published ∨
        s.status = ArticleStatus.retracted
    · exact hs
    · simp [articleCorrect, he, hs] at h
  · simp [articleCorrect, he] at h

theorem article_correct_preserves_status (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (s' : ArticleState)
    (h : articleCorrect s callerIsEditor correction = some s') :
    s'.status = s.status := by
  by_cases he : callerIsEditor = true
  · by_cases hs : s.status = ArticleStatus.published ∨
        s.status = ArticleStatus.retracted
    · by_cases hcap : s.corrections.length ≥ 32
      · simp [articleCorrect, he, hs, hcap] at h
      · simp [articleCorrect, he, hs, hcap] at h
        cases h
        rfl
    · simp [articleCorrect, he, hs] at h
  · simp [articleCorrect, he] at h

theorem article_publish_preserves_corrections (s : ArticleState) (callerIsEditor : Bool)
    (s' : ArticleState) (h : articlePublish s callerIsEditor = some s') :
    s'.corrections = s.corrections := by
  unfold articlePublish at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

theorem article_publish_correct_ordered (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (he : callerIsEditor = true)
    (hcap : s.corrections.length < 32) (s1 : ArticleState)
    (h1 : articlePublish s callerIsEditor = some s1) :
    articleCorrect s1 callerIsEditor correction = some
      { s1 with corrections := s1.corrections ++ [correction] } ∧
    (∀ s2, articleCorrect s callerIsEditor correction = some s2 →
      articlePublish s2 callerIsEditor = none) := by
  constructor
  · have hs := article_publish_sets_published s callerIsEditor s1 h1
    have hcorr := article_publish_preserves_corrections s callerIsEditor s1 h1
    have hcap1 : s1.corrections.length < 32 := by rw [hcorr]; exact hcap
    simp [articleCorrect, he, hs, Nat.not_le.mpr hcap1]
  · intro s2 h2
    have hs2 := article_correct_preserves_status s callerIsEditor correction s2 h2
    have hst := article_correct_status s callerIsEditor correction s2 h2
    apply article_publish_requires_approved s2 callerIsEditor
    rw [hs2]
    rcases hst with h | h <;> rw [h] <;> intro hc <;> cases hc

theorem article_correct_correct_independent (s : ArticleState) (callerIsEditor : Bool)
    (c1 c2 : Correction) (s1 : ArticleState) (he : callerIsEditor = true)
    (hcap : s1.corrections.length < 32)
    (h1 : articleCorrect s callerIsEditor c1 = some s1) :
    s1.corrections = s.corrections ++ [c1] ∧
    ∃ s2, articleCorrect s1 callerIsEditor c2 = some s2 ∧
      s2.corrections = s1.corrections ++ [c2] := by
  have happ := article_correct_append_only s callerIsEditor c1 s1 h1
  have hs := article_correct_preserves_status s callerIsEditor c1 s1 h1
  have hst := article_correct_status s callerIsEditor c1 s1 h1
  constructor
  · exact happ
  · refine ⟨{ s1 with corrections := s1.corrections ++ [c2] }, ?_, rfl⟩
    rw [← hs] at hst
    rcases hst with h | h <;> simp [articleCorrect, he, h, hcap]

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
