# A magazine issue

> **Status:** Implemented path for editions; the surrounding magazine workflow is a
> composition of the article and edition suites.

A magazine is a publication that thinks in issues. The masthead, roster and roles are the
same as a newsroom. The difference is that an `Edition` cell is a first-class object: a
numbered, titled, cover-hashed, ordered manifest of published articles, sealed by an editor.

## The issue cycle

1. The editor commissions pieces through the same commission escrow.
2. Each piece is published as an article with its own content hash, byline and review.
3. The editor creates an edition with a number and title hash.
4. The editor appends published articles in the reading order.
5. The editor seals the edition with a signature over the canonical manifest.

The manifest is `[editionId, publicationId, number, titleHash, coverHash, article hashes…]`
hashed with `rprint:edition:v1`. The signature is verified against the caller's public key.
Sealing is terminal: no append after seal.

## Why order is on-chain

A magazine's table of contents is part of the work. An ordered manifest commits to the
sequence, not just the set. A reader can verify that the issue they received matches the
sealed order and content hashes. A later retraction is recorded on the article; the sealed
edition remains a historical artifact.

## What the issue does not do

It does not store the PDF, the cover image or the copy. It stores hashes. The publication's
archive is the availability layer. It does not enforce a paywall; `article.access` is a
placeholder for the design-only subscription surface.

## Extending it

A magazine that wants stronger provenance can require `requireKAsset` on its articles and
link a validated r-gen KAsset before the article enters the sealed edition. A magazine that
wants cover for a large investigation can attach an r-sure Policy to the commission. Neither
changes the edition primitive.
