# Glossary

> **Status:** Reference.

**Account** — an r-cash owner account; the settlement endpoint for a funder, writer or
publication treasury.

**Arbitration** — the dispute path. The effective quorum is the publication's arbitrators,
else its admins with at least two keys, else the platform `PrintAdmin`.

**Bond / purse** — the ERTP purse held in an escrow closure. It is not a state map entry.

**Canonical publication binding** — `PublicationFactory("issued", publicationId)` returns
the one URI every child must match.

**Cell** — a Rholang name holding one state map. One writer; consume and repost once.

**Charter** — the publication's committed hashes, treasury reference, admin set, optional
arbitrators and revenue split.

**Commission** — an accepted pitch with a total, milestones and a funder. The proposal and
the escrow are separate cells.

**Correction** — an append-only record referencing an article's published content hash.

**Cover** — an optional r-sure Policy reference attached to a commission. It is the scaling
surface beyond escrow.

**Edition** — a numbered, titled, ordered manifest of published articles, sealed by an
editor signature.

**Escrow** — the baseline commission custody: one purse, milestone release, cancel, expire,
dispute.

**KAsset** — an r-gen knowledge asset, minted only by `Claim.validate`. Optional on an
article.

**Member** — a roster row keyed by the derived REV address, with a role and optional DID
anchor.

**Milestone** — `{id, kind, amount, deadlineHeight}` with a runtime status. Release requires
a prior submit and prior milestones released.

**Provenance** — an r-gen hash-linked anchor ledger bound to a KAsset. The r-print article
carries an optional `provenanceUri`.

**Publication** — the organisation cell: charter, roster, roles, pause, admin, arbitration.

**Refusal** — `(false, "reason")` after the state cell is reposted unchanged.

**Slip** — an r-sure funded premium held until bind or expire. The r-sure escrow shape, not
the r-print baseline.

**Surface** — an optional adapter or arm that is disabled by default and must be configured.

**Treasury** — the r-cash account the charter points at; r-print does not custody it.
