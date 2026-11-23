# Provenance and corrections

> **Status:** Implemented for the r-print article record; r-gen Claim/KAsset/Provenance is
> an optional surface. The article, corrections and interfaces suites pass.

Provenance is not a screenshot of a byline. It is a set of commitments a reader can check:
a content hash, an author address, a review attestation, a correction trail. r-print keeps
the editorial record; r-gen can add a validated knowledge-asset chain.

## What r-print commits to

- `contentHash` — the body the publication stood behind at publication time.
- `authors[]` — member id, DID/attestation anchor and byline hash. The member id is the
  author's derived REV address.
- `attestations[]` — `{id, kind, by, evidenceHash}` for `factcheck`, `legal` or `editor`
  review. Attestation is evidence of a review, not proof the review was correct.
- `corrections[]` — append-only `{id, kind, bodyHash, reasonHash, articleHash, by}` records
  for `correction`, `clarification` and `retraction`.
- `publishHeight` and `retractHeight` — block heights, not wall clocks.

A correction's `articleHash` is the hash of the article at the time of publication. A later
correction does not rewrite earlier entries, and no arm removes or reorders them. `retract`
appends a retraction record automatically and sets `status` to `retracted`.

## The r-gen surface

r-gen has no public K-Asset factory. A KAsset is minted only when a Claim is validated. The
full chain is:

```
ClaimFactory("create", …) -> Claim
Claim("validate", credentialUri, validation) -> KAsset
ProvenanceFactory("createBound", dId, kassetBundle, writers) -> Provenance
Provenance("anchor", dId, {kind, hash, parentHash}) -> anchored hash
```

`Article("attachKnowledge")` links the resulting KAsset, Claim and Provenance URIs. The
adapter reads `KAsset("get")`, `Claim("get")` and `Provenance("verify", hash)`. It does not
mint an identity, a claim or a KAsset; it is a reader.

The r-gen contract conventions are advisory: `quantity`, `quality` and `liability` are
stored but not validated by r-gen core. A publication that relies on them must validate
them itself.

## What is not proven

A hash is a reference, not availability. r-print does not host the article, pin the content
or check that a byline is a real person. The publication and its archive own that. A DID or
attestation hash in a member row is an anchor; BYOID verification is off-chain.
