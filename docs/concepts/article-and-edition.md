# Articles and editions

> **Status:** Implemented. The article, article_refusals, edition, behavior and corrections
> suites pass.

An article is a first-class editorial record. An edition is an ordered manifest of
published articles. They are separate cells because a magazine issue is a publication
decision, not a property of an article.

## The article cell

`ArticleFactory("create", dId, opId, articleId, data)` checks the canonical publication,
the active author roles and `Terms("article")`, then spawns one `Article` cell. The state is
`articleState`:

```
{ articleId, publicationId, publicationUri, authors[], contentHash, license,
  customLicenseHash, access, sectionHash, status, requireFactCheck, requireKAsset,
  kassetUri, claimUri, provenanceUri, credentialUri, knowledgeAtHeight,
  publishHeight, retractHeight, attestations[], corrections[], ops, schemaVersion }
```

The content hash is committed; the content itself stays off-chain. `contentHash` is frozen
at publication. Corrections reference `articleHash` and never rewrite it.

## Lifecycle

| From | Arm | To | Who |
|---|---|---|---|
| `draft` | `submit` | `submitted` | first author |
| `submitted` | `attest` | `submitted` (review appended) | factchecker/editor/publisher |
| `submitted` | `approve` | `approved` | editor/publisher |
| `approved` | `publish` | `published` | editor/publisher |
| `published` | `correct` | `published` (correction appended) | editor/factchecker/publisher |
| `published` | `retract` | `retracted` (retraction appended) | editor/publisher |
| `retracted` | `correct` | `retracted` (correction appended) | editor/factchecker/publisher |

`approve` enforces `requireFactCheck` if set and `requireKAsset` if set. Both are opt-in.
The default article path needs neither a fact-check attestation nor a K-Asset.

## Optional knowledge links

`Article("attachKnowledge", dId, opId, kassetUri, claimUri, provenanceUri, credentialUri)`
is author/editor-only. It calls `RgenAdapter("kasset")`, `RgenAdapter("claim")` and
`RgenAdapter("provenance")`; the provenance check is against the article's `contentHash`.
On success the URIs and a height are stored. K-Assets are credibility, not a gate; a
publication can set `requireKAsset` on an article when it wants one.

## The edition cell

`EditionFactory("create", dId, opId, editionId, data)` requires an editor/publisher and a
canonical publication. `editionState` holds `number`, `titleHash`, `coverHash`,
`articles[]`, `status` and a `seal`. `Edition("append", dId, opId, articleUri)` requires a
published article from the same publication, refuses a duplicate and caps the manifest at
64. `Edition("seal", dId, opId, editorSig)` hashes the canonical ordered manifest
(`rprint:edition:v1`) and verifies the caller's signature with `Verifier("sigOk")`; the
edition becomes `sealed` and immutable.

Sealing does not re-check article status. It is a historical, editor-signed artifact; a
retraction after sealing is recorded on the article. The edition's manifest keeps the
content hashes that were true when it was sealed.
