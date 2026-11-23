# Write and publish

> **Status:** Implemented. The article, corrections, edition and behavior suites verify this
> path.

## 1. Create the article

The first author calls `ArticleFactory("create")` with the canonical publication URI, author
list (member id, DID, byline hash), content hash, license, access, section hash and the
optional `requireFactCheck`/`requireKAsset` flags.

```sh
rprint article create \
  --uri <component:article-factory URI> \
  --op create:story --id story:1 --data @article.json
```

## 2. Submit, review, approve, publish

- `submit` (first author) updates the content hash and moves `draft → submitted`.
- `attest` (factchecker/editor/publisher) appends a review record.
- `approve` (editor/publisher) checks `requireFactCheck` and `requireKAsset` if set.
- `publish` (editor/publisher) moves to `published` and freezes the content hash.

```sh
rprint article submit --uri <article URI> --op submit:story --content-hash <hash>
rprint article approve --uri <article URI> --op approve:story
rprint article publish --uri <article URI> --op publish:story
```

## 3. Optional knowledge links

If you want the r-gen chain, create a Claim and validate it with a credential; the
validation mints the KAsset. Bind a Provenance record to the KAsset and anchor the content
hash. Then link the three URIs:

```sh
rprint article attach-knowledge --uri <article URI> --op know:story \
  --kasset <kasset URI> --claim <claim URI> --provenance <provenance URI> \
  --credential <credential URI>
```

The adapter reads `KAsset("get")`, `Claim("get")` and `Provenance("verify", contentHash)`.
This is optional. A publication can set `requireKAsset` on an article when it wants a
validated knowledge asset before approval.

## 4. Put it in an edition

```sh
rprint edition create --uri <component:edition-factory URI> --op create:issue \
  --id issue:1 --data @edition.json
rprint edition append --uri <edition URI> --op append:story --article <article URI>
rprint edition seal --uri <edition URI> --op seal:issue --signature <signature>
```

`append` requires a published article from the same publication and refuses duplicates. The
cap is 64. `seal` hashes the ordered manifest and verifies your signature; the edition
becomes immutable.

## 5. Correct

```sh
rprint call --uri <article URI> --binding correct \
  --args '*dId, "corr-op", "c1", "correction", "<body hash>", "<reason hash>"'
```

A correction references the published content hash and never rewrites it. `retract` appends
a retraction record. See [provenance and corrections](../concepts/provenance-and-corrections.md).
