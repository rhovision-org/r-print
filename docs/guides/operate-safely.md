# Operate safely

> **Status:** Guidance, not a security guarantee. r-print is devnet-only and unaudited.

## Keys

- A publisher key can change the roster and pause the publication. Treat it as the masthead
  key.
- A publication admin key can change the admin set, threshold and treasury. For any
  publication with real money, use at least two distinct admins and a threshold of at least
  two.
- A member key is the member's identity. The roster binds the derived REV address; do not
  share a deployer key between people.
- A funder key authorizes the escrow withdrawal. Use a dedicated account for commissions,
  not the publication's operating account.

## Escrow

- Fund a commission with money you can leave locked until the milestones are resolved.
- Read the milestones before funding: ids, amounts, deadlines and the hard deadline.
- Know the dispute default. A solo publication falls back to the platform quorum; if you
  want an independent quorum, add an `arbitrators` set or a second admin key.
- Do not retry a value-moving deploy with a new op id. Require finality and the stored reply.

## Content

- r-print stores hashes, not content. Your archive is the availability layer. Back it up.
- A correction is append-only. Do not publish a "corrected" article by mutating the old
  hash; publish a correction record and, if needed, a new article.
- A sealed edition is historical. A later retraction is recorded on the article.

## Sibling surfaces

- The r-sure and r-gen adapters are disabled by default. Enabling them is a deliberate
  configuration step; read the sibling status pages first.
- `attachCover` verifies a policy URI but does not open a claim or settle cover. The
  `claimsLoss` edge is design.
- `attachKnowledge` verifies a Claim, KAsset and Provenance URI, but r-gen core does not
  validate the quantity/quality/liability conventions. Validate them yourself if you rely
  on them.
- BYOID DIDs and quantum-os outcomes are anchors. Verification is off-chain.

## Legal and financial

No real funds; not legal, tax or financial advice. A publication is responsible for
employment, contractor, defamation, privacy and data-protection law in its jurisdiction.
