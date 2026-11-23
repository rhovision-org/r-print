# Access and reader revenue

> **Status:** Design. No subscription, paywall or revenue-split contract is deployed in
> v0.1.

The article cell already stores `access` (`open`, `members`, `embargoed`) and the charter
already stores a `revenueSplit` list of member bps entries. Those fields are placeholders
for a reader-revenue layer, not an implemented paywall.

## The design

A subscription cell would read a publication URI and an r-cash account, hold a reader
entitlement for a period or issue count, and expose an access token. A single-article
purchase would mint a narrower entitlement. A revenue ledger would read the charter's split
and the article's bylines, accrue shares and let members claim.

The edges are named in [the integration graph](../reference/integration-graph.md):
`entitles` from `subscription` to `article`, and `splitsRevenue` from `publication` to
`member`. The attachment points are `article.access`, `charter.revenueSplit` and the
publication's `treasuryAccountId`.

## Why it is not first

Reader revenue is a business model, not a primitive. A publication can start with escrowed
commissions and reader support off-chain; the chain does not need to mediate every
subscription before the editorial core works. The charter's split is already validated to
10000 bps or empty, so a later ledger can attach without changing v0.1 state.

## Honest limits

A split is not a payment. A bps entry says who should be paid and how much; it does not
prove the money exists or that tax was withheld. A paywall is not confidentiality: content
hashes and metadata remain public. Fiat billing, refunds, chargebacks and reader identity
are out of scope.
