# Investigation funding

> **Status:** Design for crowdfunding and bounties. The baseline commission escrow already
> supports a single funder and multi-milestone work.

An investigation is the hard case: months of work, uncertain findings, and a writer who
needs living expenses before there is a story. The baseline commission handles one funder
committing a total against milestones. A publication that wants to crowdfund a story needs
a multi-funder version.

## The design

A campaign cell would reference a publication, a brief hash, a target, a deadline and a
refund rule. Funders contribute to an escrow; if the target is not met by the deadline,
contributions refund; if it is met, the campaign becomes a commission with the same
milestone release rule. The named edge is `funds` into the escrow and `refunds` on expiry;
the funding source is a set of patron accounts rather than one account.

A bounty is the narrower case: one funder, one deliverable, a fixed reward on acceptance.
The baseline commission already supports it by treating the reward as a single final
milestone.

## Relationship to r-sure

Escrow is the baseline. At scale, a publication may want cover against non-delivery or a
larger investigation risk. The `covers` edge attaches an r-sure Policy to the commission;
`claimsLoss` (design) would open an r-sure claim on a breach. The publication should not
have to choose between escrow and insurance: it can start with escrow and attach a policy
when the sums justify underwriting.

## Honest limits

Crowdfunding, securities law, contributor identity and refunds in fiat are out of scope.
The design assumes REV-denominated contributions and a publication that can identify its
funders by REV address. A campaign does not prove the investigation will be good, only that
the money was committed and the release rule was followed.
