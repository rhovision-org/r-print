# Invariants

> **Status:** Foundation. The numbered invariants below are the v0.1 obligations; the suite
> map records which ones are exercised. `spec/lean/` carries the `proved-model` obligations
> named in `spec/flows/core.yaml`; it is not a Rholang refinement.

## Cells and authority

- **I1.** Each entity has one state cell with one writer. A mutating arm consumes, validates
  and reposts exactly once; a refusal reposts unchanged.
- **I2.** A child record is bound to the canonical publication URI issued by
  `PublicationFactory`.
- **I3.** Member identity is the derived REV address of the deployer key. A publisher may add
  an address; only the key that derives to it can act as that member.
- **I4.** Removing the last active publisher is refused. Removed members are never deleted.
- **I5.** Platform admin sets require at least two distinct keys and threshold at least two.
  Publication admin sets allow 1-of-1 solo mode.

## Escrow

- **I6.** A commission is funded once, upfront, for the full total.
- **I7.** A milestone is submitted by the writer and released by a live editor or publisher;
  no release without a prior submit.
- **I8.** A milestone pays at most once.
- **I9.** At a terminal state, `paidWriter + refundedFunder + fee == total` and the escrow
  purse is empty.
- **I10.** `cancel`, `expire` and `resolveDispute` refund at most the remaining balance.
- **I11.** A solo publisher cannot arbitrate their own commission; the effective arbitration
  quorum is the publication `arbitrators`, else publication admins with at least two distinct
  keys, else the platform `PrintAdmin`.

## Articles and editions

- **I12.** A published article's content hash is frozen. No arm rewrites it; corrections
  append.
- **I13.** Corrections are append-only. No arm removes, rewrites or reorders them.
- **I14.** A retraction appends a retraction record; it does not erase the article.
- **I15.** An edition append requires a published article from the same canonical publication
  and refuses duplicates.
- **I16.** A sealed edition manifest is immutable and carries an editor signature over the
  canonical ordered manifest.

## Interfaces and money

- **I17.** BYOID DID and attestation fields are anchors, not proof. No on-chain DID
  verification is claimed.
- **I18.** A quantum-os coordination record is provenance, not authority.
- **I19.** Money is integer minor units. Block heights, not wall clocks, carry deadlines.
- **I20.** Spec-only features (subscriptions, revenue splits, crowdfunding, tips, syndication)
  do not change v0.1 cell semantics.

## Client

- **I21.** A client write is a success only after the deploy is processed with success, its
  block is final, and the reply is `(true, …)`. A `(false, reason)` reply is a refusal, not an
  error. A processed deploy that never finalizes is never reported as success.
- **I22.** Reads use explore-deploy and a term that replies on its first private name; writes
  use the signed-deploy shape and a reply on `deployId`.
- **I23.** An ambiguous submit is retried with the same operation id (preferably by polling
  the deploy id or re-POSTing the same signed body), never with a fresh operation id. The key
  is held only in WASM; no client export returns a plaintext secret.
