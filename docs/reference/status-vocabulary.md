# Status vocabulary

> **Status:** Implemented. The suites assert these exact strings.

## Publication

`active`, `paused`, `closed` (reserved). Member: `active`, `removed`.

## Commission

Proposal: `proposed`, `accepted`, `funded`, `cancelled`. Escrow: `active`, `completed`,
`cancelled`, `disputed`, `arbitrated`, `expired`. Milestone: `pending`, `submitted`,
`released`, `refunded`, `arbitrated`.

## Article and edition

Article: `draft`, `submitted`, `approved`, `published`, `retracted`.
Edition: `draft`, `sealed`.

## Roles

`publisher`, `editor`, `writer`, `factchecker`, `treasurer`, `contributor`.

## Licenses and access

License: `all-rights`, `cc-by-4.0`, `cc-by-sa-4.0`, `cc0`, `custom`.
Access: `open`, `members`, `embargoed`.

## Correction and milestone kinds

Correction: `correction`, `clarification`, `retraction`.
Milestone: `stipend`, `draft`, `final`, `expense`, `bonus`.
Attestation: `factcheck`, `legal`, `editor`.

## Refusal reasons

`unknown component`, `retired`, `stale`, `frozen`, `not installer`, `duplicate`, `replay`,
`below threshold`, `threshold`, `unknown action`, `asset`, `rcash unavailable`,
`payments unavailable`, `publication`, `publication unavailable`, `not member`,
`unknown member`, `role`, `paused`, `closed`, `last publisher`, `members`, `ops full`,
`status`, `milestone`, `not writer`, `not editor`, `not funder`, `not author`, `not signer`,
`amount`, `total`, `deadline`, `too early`, `too late`, `submitted`, `not submitted`,
`released`, `refunded`, `arbitrated`, `dispute`, `signature`, `hash`, `did`, `license`,
`access`, `article`, `edition`, `edition full`, `attestations`, `corrections`, `unknown`,
`kasset`, `rgen adapter`, `claim`, `provenance`, `rsure adapter`, `not owner`, `cover`,
`policy`, `policy status`, `insured`, `kasset claim`, `claim kasset`, `claim status`,
`provenance asset`, `provenance claim`, `provenance hash`, `author`, `credential`,
`knowledge`, `uri`.

## Formal-model status

These labels describe the Lean model, not the deployed contract:

| Label | Meaning |
|---|---|
| `proved-model` | Machine-checked about the Lean model; no node tie. |
| `proved-conformance` | The theorem, an emitted `spec/vectors/core.tsv` row and a deployed suite assertion. A finite evidence bundle, not a refinement. |
| `proved-model-bounded` | Machine-checked over a stated finite bound. |
| `proved-but-narrower` | A theorem with a recorded narrower scope or gap; see `spec/proofs/rigor.yaml`. |
| `modeled` | A transition exists; no safety theorem. |
| `mechanism` | A client mechanism with test or live evidence; no Lean theorem. |
| `assumption` | An explicit boundary assumption; not proved. |
| `owed` | An arm outside the current model. |
| `open` | Not yet analysed. |

`measured` and `recorded` are ledger verdicts for a count or a campaign, not a
proof. A `proved-conformance` claim is rejected unless all three legs are
present; `make check-conformance` enforces the bundle.

`proved-model` never means a Rholang refinement, an audit or a deployed-contract proof. The
flow manifest in `spec/flows/core.yaml` carries the per-arm label.

## Rule

A refusal reason is part of the interface. Do not rename one without updating the suites,
this page and the client. A vague reason is a bug: `role` must mean an authority failure,
`status` must mean a state-machine failure, `duplicate` must mean an id or replay collision.
