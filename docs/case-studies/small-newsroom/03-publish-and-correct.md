# Publish and correct

> **Status:** Implemented. The article, corrections, edition and behavior suites cover this
> chapter.

Cora's draft becomes an article. The publication reviews it, publishes it, puts it in an
edition and corrects a detail the next day.

## The article

Cora calls `ArticleFactory("create")` with her member id, DID, byline hash, content hash,
license (`cc-by-4.0`), access (`open`), section hash, `requireFactCheck` off and
`requireKAsset` off. The factory checks the canonical publication, the active author role
and `Terms("article")`.

She calls `submit` with the final copy hash. Dee, the factchecker, calls `attest` with a
`factcheck` record and an evidence hash. Bram calls `approve`, then `publish`. The article
stores `publishHeight` and freezes `contentHash`.

Cora could optionally call `attachKnowledge` with an r-gen Claim, KAsset and Provenance URI.
She does not for this story. The field exists, the adapter verifies the URIs, and the
publication can require it on a future article by setting `requireKAsset`.

## The edition

Bram creates `Edition 1` with a number, title hash and cover hash. He appends Cora's
published article. The edition manifest stores the article id, URI, content hash and
optional K-Asset URI. He seals it by signing the canonical ordered manifest; the edition
becomes `sealed` and cannot be appended to again.

## The correction

The next day the newsroom discovers that a contract value was misstated. Bram calls
`Article("correct")` with a correction id, kind `correction`, a body hash and a reason hash.
The correction record references the original `articleHash`; the article's `contentHash`
does not change. A second, smaller fix is a `clarification`. The corrections list is
append-only: no arm removes or reorders it.

If the error had been fatal to the story, Bram would call `retract`. The article status
becomes `retracted` and a `retraction` record is appended automatically. Corrections after a
retraction are still allowed; the record shows the sequence.

## What the reader can check

The reader gets the copy from the publication's archive and the article URI from the
publication page. The on-chain record shows the content hash, the byline address, the
review attestation, the edition manifest hash and the correction trail. It does not prove
the copy is available or that the byline is a real person; those are the publication's
responsibilities.
