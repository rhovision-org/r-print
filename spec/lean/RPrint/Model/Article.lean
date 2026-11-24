import RPrint.Basic

/-!
# Article lifecycle

An article moves `draft → submitted → approved → published → retracted`.
`submit` is the only arm that writes a content hash, and only from `draft`.
`publish` freezes the hash. `correct` appends a correction record; `retract`
appends a retraction record and never erases the article.

The model is shallow: a content hash is an `Id`, a K-Asset URI is an `Option Id`,
and the author/editor guards are `Bool` parameters. Refusal strings are not
modelled.
-/

namespace RPrint

inductive ArticleStatus where
  | draft | submitted | approved | published | retracted
  deriving DecidableEq, Repr

inductive CorrectionKind where
  | correction | clarification | retraction
  deriving DecidableEq, Repr

structure Correction where
  kind : CorrectionKind
  bodyHash : Id
  reasonHash : Id
  articleHash : Id
  deriving DecidableEq, Repr

structure Attestation where
  id : Id
  kind : Id
  attestor : Id
  evidenceHash : Id
  deriving DecidableEq, Repr

structure ArticleState where
  articleId : Id
  publicationId : Id
  firstAuthor : Id
  status : ArticleStatus
  contentHash : Id
  kassetUri : Option Id
  requireKAsset : Bool
  corrections : List Correction
  attestations : List Attestation
  publishedContentHash : Option Id
  deriving DecidableEq, Repr

def articleTerminal : ArticleStatus → Bool
  | ArticleStatus.retracted => true
  | _ => false

def articleSubmit (s : ArticleState) (callerIsAuthor : Bool) (newHash : Id) :
    Option ArticleState :=
  if !callerIsAuthor then none
  else if s.status = ArticleStatus.draft then
    some { s with status := ArticleStatus.submitted, contentHash := newHash }
  else none

theorem article_submit_requires_author (s : ArticleState) (callerIsAuthor : Bool)
    (newHash : Id) (h : callerIsAuthor = false) :
    articleSubmit s callerIsAuthor newHash = none := by
  simp [articleSubmit, h]

theorem article_submit_requires_draft (s : ArticleState) (callerIsAuthor : Bool)
    (newHash : Id) (h : s.status ≠ ArticleStatus.draft) :
    articleSubmit s callerIsAuthor newHash = none := by
  by_cases ha : callerIsAuthor = true
  · simp [articleSubmit, ha, h]
  · have haf : callerIsAuthor = false := by simpa using ha
    simp [articleSubmit, haf]

theorem article_submit_rewrites_hash (s : ArticleState) (callerIsAuthor : Bool)
    (newHash : Id) (s' : ArticleState)
    (h : articleSubmit s callerIsAuthor newHash = some s') :
    s'.contentHash = newHash := by
  unfold articleSubmit at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

def articleAttachKnowledge (s : ArticleState) (callerAuthorized : Bool)
    (kassetUri : Id) : Option ArticleState :=
  if !callerAuthorized then none
  else if s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved then
    some { s with kassetUri := some kassetUri }
  else none

theorem article_attachKnowledge_refused_after_publish (s : ArticleState)
    (callerAuthorized : Bool) (kassetUri : Id) (h : s.status = ArticleStatus.published) :
    articleAttachKnowledge s callerAuthorized kassetUri = none := by
  by_cases ha : callerAuthorized = true
  · simp [articleAttachKnowledge, ha, h]
  · have haf : callerAuthorized = false := by simpa using ha
    simp [articleAttachKnowledge, haf]

theorem article_attachKnowledge_refused_from_draft (s : ArticleState)
    (callerAuthorized : Bool) (kassetUri : Id) (h : s.status = ArticleStatus.draft) :
    articleAttachKnowledge s callerAuthorized kassetUri = none := by
  by_cases ha : callerAuthorized = true
  · simp [articleAttachKnowledge, ha, h]
  · have haf : callerAuthorized = false := by simpa using ha
    simp [articleAttachKnowledge, haf]

theorem article_attachKnowledge_preserves_hash (s : ArticleState)
    (callerAuthorized : Bool) (kassetUri : Id) (s' : ArticleState)
    (h : articleAttachKnowledge s callerAuthorized kassetUri = some s') :
    s'.contentHash = s.contentHash := by
  unfold articleAttachKnowledge at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

def articleAttest (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) : Option ArticleState :=
  if !callerQualified then none
  else if s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved then
    if s.attestations.length ≥ 16 then none
    else some { s with attestations := s.attestations ++ [attestation] }
  else none

theorem article_attest_requires_role (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) (h : callerQualified = false) :
    articleAttest s callerQualified attestation = none := by
  simp [articleAttest, h]

theorem article_attest_requires_status (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) (h : s.status ≠ ArticleStatus.submitted)
    (h2 : s.status ≠ ArticleStatus.approved) :
    articleAttest s callerQualified attestation = none := by
  by_cases hq : callerQualified = true
  · simp [articleAttest, hq, h, h2]
  · have hqf : callerQualified = false := by simpa using hq
    simp [articleAttest, hqf]

theorem article_attest_cap (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) (hq : callerQualified = true)
    (hs : s.status = ArticleStatus.submitted ∨ s.status = ArticleStatus.approved)
    (hcap : s.attestations.length ≥ 16) :
    articleAttest s callerQualified attestation = none := by
  rcases hs with hs | hs
  · simp [articleAttest, hq, hs, hcap]
  · simp [articleAttest, hq, hs, hcap]

theorem article_attest_append_only (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) (s' : ArticleState)
    (h : articleAttest s callerQualified attestation = some s') :
    s'.attestations = s.attestations ++ [attestation] := by
  unfold articleAttest at h
  split at h
  · simp at h
  · split at h
    · split at h
      · simp at h
      · simp at h
        cases h
        rfl
    · simp at h

theorem article_attest_preserves_hash (s : ArticleState) (callerQualified : Bool)
    (attestation : Attestation) (s' : ArticleState)
    (h : articleAttest s callerQualified attestation = some s') :
    s'.contentHash = s.contentHash := by
  unfold articleAttest at h
  split at h
  · simp at h
  · split at h
    · split at h
      · simp at h
      · simp at h
        cases h
        rfl
    · simp at h

def articleApprove (s : ArticleState) (callerIsEditor : Bool) : Option ArticleState :=
  if !callerIsEditor then none
  else if s.status = ArticleStatus.submitted then
    if s.requireKAsset && s.kassetUri.isNone then none
    else some { s with status := ArticleStatus.approved }
  else none

theorem article_approve_requires_editor (s : ArticleState) (callerIsEditor : Bool)
    (h : callerIsEditor = false) : articleApprove s callerIsEditor = none := by
  simp [articleApprove, h]

theorem article_approve_requires_submitted (s : ArticleState) (callerIsEditor : Bool)
    (h : s.status ≠ ArticleStatus.submitted) :
    articleApprove s callerIsEditor = none := by
  by_cases he : callerIsEditor = true
  · simp [articleApprove, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [articleApprove, hef]

theorem article_approve_requires_kasset (s : ArticleState) (callerIsEditor : Bool)
    (he : callerIsEditor = true) (hs : s.status = ArticleStatus.submitted)
    (hr : s.requireKAsset = true) (hk : s.kassetUri = none) :
    articleApprove s callerIsEditor = none := by
  simp [articleApprove, he, hs, hr, hk]

def articlePublish (s : ArticleState) (callerIsEditor : Bool) : Option ArticleState :=
  if !callerIsEditor then none
  else if s.status = ArticleStatus.approved then
    some { s with
      status := ArticleStatus.published,
      publishedContentHash := some s.contentHash }
  else none

theorem article_publish_requires_editor (s : ArticleState) (callerIsEditor : Bool)
    (h : callerIsEditor = false) : articlePublish s callerIsEditor = none := by
  simp [articlePublish, h]

theorem article_publish_requires_approved (s : ArticleState) (callerIsEditor : Bool)
    (h : s.status ≠ ArticleStatus.approved) :
    articlePublish s callerIsEditor = none := by
  by_cases he : callerIsEditor = true
  · simp [articlePublish, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [articlePublish, hef]

theorem article_publish_freezes_hash (s : ArticleState) (callerIsEditor : Bool)
    (s' : ArticleState) (h : articlePublish s callerIsEditor = some s') :
    s'.contentHash = s.contentHash ∧ s'.publishedContentHash = some s.contentHash := by
  unfold articlePublish at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      exact ⟨rfl, rfl⟩
    · simp at h

def articleCorrect (s : ArticleState) (callerIsEditor : Bool) (correction : Correction) :
    Option ArticleState :=
  if !callerIsEditor then none
  else if s.status = ArticleStatus.published ∨ s.status = ArticleStatus.retracted then
    if s.corrections.length ≥ 32 then none
    else some { s with corrections := s.corrections ++ [correction] }
  else none

theorem article_correct_requires_editor (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (h : callerIsEditor = false) :
    articleCorrect s callerIsEditor correction = none := by
  simp [articleCorrect, h]

theorem article_correct_only_published_or_retracted (s : ArticleState)
    (callerIsEditor : Bool) (correction : Correction)
    (h : s.status ≠ ArticleStatus.published) (h2 : s.status ≠ ArticleStatus.retracted) :
    articleCorrect s callerIsEditor correction = none := by
  by_cases he : callerIsEditor = true
  · simp [articleCorrect, he, h, h2]
  · have hef : callerIsEditor = false := by simpa using he
    simp [articleCorrect, hef]

theorem article_correct_append_only (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (s' : ArticleState)
    (h : articleCorrect s callerIsEditor correction = some s') :
    s'.corrections = s.corrections ++ [correction] := by
  unfold articleCorrect at h
  split at h
  · simp at h
  · split at h
    · split at h
      · simp at h
      · simp at h
        cases h
        rfl
    · simp at h

theorem article_correct_preserves_hash (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (s' : ArticleState)
    (h : articleCorrect s callerIsEditor correction = some s') :
    s'.contentHash = s.contentHash := by
  unfold articleCorrect at h
  split at h
  · simp at h
  · split at h
    · split at h
      · simp at h
      · simp at h
        cases h
        rfl
    · simp at h

theorem article_correct_cap (s : ArticleState) (callerIsEditor : Bool)
    (correction : Correction) (he : callerIsEditor = true)
    (hs : s.status = ArticleStatus.published ∨ s.status = ArticleStatus.retracted)
    (hcap : s.corrections.length ≥ 32) :
    articleCorrect s callerIsEditor correction = none := by
  rcases hs with hs | hs
  · simp [articleCorrect, he, hs, hcap]
  · simp [articleCorrect, he, hs, hcap]

def articleRetract (s : ArticleState) (callerIsEditor : Bool) (reasonHash : Id) :
    Option ArticleState :=
  if !callerIsEditor then none
  else if s.status = ArticleStatus.published then
    some { s with
      status := ArticleStatus.retracted,
      corrections := s.corrections ++
        [{ kind := CorrectionKind.retraction, bodyHash := 0, reasonHash := reasonHash,
           articleHash := s.contentHash }] }
  else none

theorem article_retract_only_published (s : ArticleState) (callerIsEditor : Bool)
    (reasonHash : Id) (h : s.status ≠ ArticleStatus.published) :
    articleRetract s callerIsEditor reasonHash = none := by
  by_cases he : callerIsEditor = true
  · simp [articleRetract, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [articleRetract, hef]

theorem article_retract_appends_record (s : ArticleState) (callerIsEditor : Bool)
    (reasonHash : Id) (s' : ArticleState)
    (h : articleRetract s callerIsEditor reasonHash = some s') :
    s'.status = ArticleStatus.retracted ∧
      ∃ c, s'.corrections = s.corrections ++ [c] := by
  unfold articleRetract at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      exact ⟨rfl, ⟨_, rfl⟩⟩
    · simp at h

theorem article_retract_preserves_hash (s : ArticleState) (callerIsEditor : Bool)
    (reasonHash : Id) (s' : ArticleState)
    (h : articleRetract s callerIsEditor reasonHash = some s') :
    s'.contentHash = s.contentHash := by
  unfold articleRetract at h
  split at h
  · simp at h
  · split at h
    · simp at h
      cases h
      rfl
    · simp at h

end RPrint
