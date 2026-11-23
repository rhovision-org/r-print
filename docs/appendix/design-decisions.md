# Design decisions

> **Status:** Reference. These are the decisions a fork should understand before changing
> the contracts.

## Escrow is the baseline

The baseline escrow is one purse, milestone release, cancel, expire, dispute and
arbitration. It is deliberately smaller than an insurance market. It is the thing a small
publication can audit and run on day one.

## r-sure is a surface, not a dependency

Escrow becomes dead money at scale. `CommissionProposal.attachCover` records a verified
r-sure Policy reference; the r-sure adapter is disabled by default. The commission keeps its
escrow semantics. `claimsLoss` and `settles` are design edges because they need the policy
token holder.

## K-Assets are optional

r-gen has no public K-Asset factory; a KAsset is minted by `Claim.validate`. r-print does not
force every writer through a claim/credential flow. `Article.attachKnowledge` links a Claim,
KAsset and Provenance when the publication wants stronger credibility; `requireKAsset` is an
opt-in gate.

## Solo mode

A publication may start 1-of-1. The arbitration fallback to the platform quorum is the
safety valve: a solo publisher can release milestones but cannot unilaterally arbitrate
against a funder. A publication that wants an independent quorum adds admins or
arbitrators.

## Canonical publication binding

Every child factory checks `PublicationFactory("issued", publicationId)`. A caller-supplied
URI is not trusted. This is the provenance cornerstone; removing it lets someone claim a
masthead they do not control.

## One cell per entity

There is no global counter, no mutable availability cache and no capability in a state map.
The publication factory, commission factory, article factory and edition factory keep
issuance/replay maps; the entities keep their own state.

## Hashes, no content

The chain stores hashes and URIs. Content availability is the publication's archive. This
keeps the terms small and avoids pretending a chain is a CMS.

## Block heights, no timers

Deadlines and dispute windows are block heights. Expiry is lazy and permissionless. There is
no timer service to trust.

## Surface over integration

BYOID and quantum-os are POC-stage; they are anchors and documented edges, not hard
dependencies. r-gen and r-sure roots are pinned in configs but disabled until enabled. A fork
can turn them on without changing the baseline.

## No web wallet in v0.1

The browser is a typed sketch. The working client is the Rust SDK/CLI/WASM term builder plus
the r-cash signer. Shipping a half-wallet would be worse than specifying one.
