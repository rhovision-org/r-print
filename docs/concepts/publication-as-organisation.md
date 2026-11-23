# A publication as an organisation

> **Status:** Implemented. The publication cell, charter validation and roster suites pass.

A publication is the masthead, not the writer. It has one `publicationState` cell that owns
the charter, the roster, the editorial admin set and the arbitration rule. The factory that
creates it validates the charter through `Terms` before the cell exists.

## The charter

The charter is a map with the publication's public commitments:

| Field | Meaning |
|---|---|
| `nameHash`, `mastheadHash`, `taglineHash` | Committed hashes, never raw copy |
| `treasuryAccountId` | The r-cash account a publication points readers and funders at |
| `assetId` | `REV` in v0.1 |
| `admins`, `threshold` | The publication admin set, 1–5 keys |
| `arbitrators`, `arbitrationThreshold` | Optional independent quorum, 2–5 keys |
| `revenueSplit` | Member bps entries, validated to sum to 10000 or be empty |
| `governance` | Fact-check and K-Asset policy, dispute window, member cap |

The charter hash is `Codec("hash", "rprint:charter:v1", …)` over the public fields. It is
stored in the cell and recomputed when the treasury changes.

## The factory

`PublicationFactory("create", dId, opId, publicationId, charter, members)`:

1. Derives the creator's REV address and checks it is a member with role `publisher`.
2. Validates `publicationId` and calls `Terms("charter", charter, members)`.
3. Refuses a duplicate id; replays return the stored URI.
4. Spawns one `Publication` cell through `component:publication-cell-factory` and records the
   canonical `publicationId → URI` binding.

`PublicationFactory("issued", publicationId)` is the canonical lookup every child contract
uses. A child that accepts a caller-supplied publication URI without checking `issued`
would let someone forge provenance under a masthead they do not control.

## The cell

Read arms: `info`, `status`, `charter`, `charterHash`, `members`, `member`, `roleOf`,
`treasury`, `admins`, `arbitration`, `nonce`. Write arms: `addMember`, `removeMember`,
`setRole`, `attestSelf`, `pause`, and the signed `admin` arm for `setAdmins`,
`setThreshold` and `setTreasury`.

Every write consumes the cell, checks an `opId` replay key, validates, writes once and
replies. A refusal reposts the cell unchanged. A paused publication refuses new roster
writes and new commissions/articles; existing escrow releases stay available.

## Why a cell, not a token

A token gives a balance; it does not give a roster, a role, a charter or an arbitration
rule. The cell makes the organisation's commitments readable in one place. A fork can put a
token in front of it later, but the token is not the organisation.
