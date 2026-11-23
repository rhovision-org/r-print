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
`kasset`, `rgen adapter`, `claim`, `provenance`, `rsure adapter`, `not owner`.

## Rule

A refusal reason is part of the interface. Do not rename one without updating the suites,
this page and the client. A vague reason is a bug: `role` must mean an authority failure,
`status` must mean a state-machine failure, `duplicate` must mean an id or replay collision.
