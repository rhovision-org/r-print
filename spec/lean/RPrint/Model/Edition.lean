import RPrint.Basic
import RPrint.Model.Article

/-!
# Edition seal

An edition moves `draft → sealed`. `append` requires a published article from
the same publication, refuses duplicates and caps the manifest at 64 entries.
`seal` requires a non-empty manifest and an editor signature over the canonical
ordered manifest; a sealed edition is terminal.

The model is shallow: article URIs and content hashes are `Id`s, and the
signature check is a `Bool` parameter.
-/

namespace RPrint

inductive EditionStatus where
  | draft | sealed
  deriving DecidableEq, Repr

structure ManifestEntry where
  articleId : Id
  articleUri : Id
  contentHash : Id
  deriving DecidableEq, Repr

structure EditionState where
  editionId : Id
  publicationId : Id
  status : EditionStatus
  articles : List ManifestEntry
  sealHash : Option Id
  editorId : Option Id
  editorSig : Option Id
  deriving DecidableEq, Repr

def editionAppend (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) : Option EditionState :=
  if !callerIsEditor then none
  else if s.status = EditionStatus.draft then
    if articleStatus = ArticleStatus.published then
      if articlePublication = s.publicationId then
        if s.articles.any (fun e => e.articleId = articleId) then none
        else if s.articles.length ≥ 64 then none
        else
          some { s with
            articles := s.articles ++
              [{ articleId := articleId, articleUri := articleUri,
                 contentHash := contentHash }] }
      else none
    else none
  else none

theorem edition_append_requires_editor (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (h : callerIsEditor = false) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  simp [editionAppend, h]

theorem edition_append_requires_draft (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id) (h : s.status ≠ EditionStatus.draft) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  by_cases he : callerIsEditor = true
  · simp [editionAppend, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [editionAppend, hef]

theorem edition_append_requires_published_article (s : EditionState)
    (callerIsEditor : Bool) (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id)
    (h : articleStatus ≠ ArticleStatus.published) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  by_cases he : callerIsEditor = true
  · by_cases hd : s.status = EditionStatus.draft
    · simp [editionAppend, he, hd, h]
    · simp [editionAppend, he, hd]
  · have hef : callerIsEditor = false := by simpa using he
    simp [editionAppend, hef]

theorem edition_append_same_publication (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id)
    (h : articlePublication ≠ s.publicationId) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  by_cases he : callerIsEditor = true
  · by_cases hd : s.status = EditionStatus.draft
    · by_cases hp : articleStatus = ArticleStatus.published
      · simp [editionAppend, he, hd, hp, h]
      · simp [editionAppend, he, hd, hp]
    · simp [editionAppend, he, hd]
  · have hef : callerIsEditor = false := by simpa using he
    simp [editionAppend, hef]

theorem edition_append_refuses_duplicate (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (hp : articleStatus = ArticleStatus.published)
    (hsame : articlePublication = s.publicationId)
    (hdup : s.articles.any (fun e => e.articleId = articleId) = true) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  simp [editionAppend, he, hd, hp, hsame, hdup]

theorem edition_append_cap (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (hp : articleStatus = ArticleStatus.published)
    (hsame : articlePublication = s.publicationId)
    (hnodup : s.articles.any (fun e => e.articleId = articleId) = false)
    (hcap : s.articles.length ≥ 64) :
    editionAppend s callerIsEditor articlePublication articleStatus articleId articleUri
      contentHash = none := by
  simp [editionAppend, he, hd, hp, hsame, hnodup, hcap]

theorem edition_append_guards (s : EditionState) (callerIsEditor : Bool)
    (articlePublication : Id) (articleStatus : ArticleStatus)
    (articleId articleUri contentHash : Id)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (hp : articleStatus = ArticleStatus.published)
    (hsame : articlePublication = s.publicationId)
    (hnodup : s.articles.any (fun e => e.articleId = articleId) = false)
    (hcap : s.articles.length < 64) :
    ∃ s', editionAppend s callerIsEditor articlePublication articleStatus articleId
        articleUri contentHash = some s' ∧
      s'.articles = s.articles ++
        [{ articleId := articleId, articleUri := articleUri,
           contentHash := contentHash }] := by
  refine ⟨{ s with
    articles := s.articles ++
      [{ articleId := articleId, articleUri := articleUri,
         contentHash := contentHash }] }, ?_, rfl⟩
  simp [editionAppend, he, hd, hp, hsame, hnodup, hcap]

def editionSeal (s : EditionState) (callerIsEditor : Bool) (editorId : Id)
    (manifestHash : Id) (sigOk : Bool) : Option EditionState :=
  if !callerIsEditor then none
  else if s.status = EditionStatus.draft then
    if s.articles.length > 0 then
      if sigOk then
        some { s with
          status := EditionStatus.sealed,
          sealHash := some manifestHash,
          editorId := some editorId,
          editorSig := some manifestHash }
      else none
    else none
  else none

theorem edition_seal_requires_editor (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (h : callerIsEditor = false) :
    editionSeal s callerIsEditor editorId manifestHash sigOk = none := by
  simp [editionSeal, h]

theorem edition_seal_requires_draft (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool)
    (h : s.status ≠ EditionStatus.draft) :
    editionSeal s callerIsEditor editorId manifestHash sigOk = none := by
  by_cases he : callerIsEditor = true
  · simp [editionSeal, he, h]
  · have hef : callerIsEditor = false := by simpa using he
    simp [editionSeal, hef]

theorem edition_seal_requires_nonempty (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (h : s.articles.length = 0) :
    editionSeal s callerIsEditor editorId manifestHash sigOk = none := by
  simp [editionSeal, he, hd, h]

theorem edition_seal_requires_signature (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool)
    (he : callerIsEditor = true) (hd : s.status = EditionStatus.draft)
    (hn : s.articles.length > 0) (hs : sigOk = false) :
    editionSeal s callerIsEditor editorId manifestHash sigOk = none := by
  simp [editionSeal, he, hd, hn, hs]

theorem edition_seal_binds_manifest (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (s' : EditionState)
    (h : editionSeal s callerIsEditor editorId manifestHash sigOk = some s') :
    s'.status = EditionStatus.sealed ∧ s'.sealHash = some manifestHash ∧
      s'.editorId = some editorId := by
  unfold editionSeal at h
  split at h
  · simp at h
  · split at h
    · split at h
      · split at h
        · simp at h
          cases h
          exact ⟨rfl, rfl, rfl⟩
        · simp at h
      · simp at h
    · simp at h

theorem edition_sealed_manifest_immutable (s : EditionState) (callerIsEditor : Bool)
    (editorId manifestHash : Id) (sigOk : Bool) (h : s.status = EditionStatus.sealed) :
    editionSeal s callerIsEditor editorId manifestHash sigOk = none ∧
      editionAppend s callerIsEditor s.publicationId ArticleStatus.published 0 0 0 = none := by
  constructor
  · simp [editionSeal, h]
  · simp [editionAppend, h]

/-! ## Factory creation

The edition factory's terms and status reads are Bool atoms in the shallow guard
model. -/

def editionFactoryCreate (s : FactoryState) (id : Id)
    (authorized editionOk statusOk : Bool) : Option FactoryState :=
  if !authorized then none
  else if !editionOk then none
  else if !statusOk then none
  else if id ∈ s.issued then none
  else some { s with issued := id :: s.issued }

end RPrint
