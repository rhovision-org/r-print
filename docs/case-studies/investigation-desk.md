# An investigation desk

> **Status:** Baseline escrow and dispute path implemented; crowdfunding, multi-funder
> campaigns and cover claims are design.

An investigation desk is a publication whose main product is long work. It needs three
things a daily newsroom can defer: living expenses during research, a dispute path that
does not depend on the funder's goodwill, and a way to scale risk beyond one purse.

## The commission shape

A desk typically uses three milestones:

| Milestone | Kind | Purpose |
|---|---|---|
| `m1` | `stipend` | Three to six weeks of records work and interviews |
| `m2` | `expense` | Travel, records fees, a fixer or a local researcher |
| `m3` | `final` | Delivery and publication |

The baseline escrow treats the kinds as labels; the editor enforces the editorial meaning.
The order is enforced: `m3` cannot release before `m1` and `m2` are released. The deadlines
are block heights; the hard deadline is the last milestone plus grace.

## The trust problem

A writer should not have to choose between eating and trusting a funder. The stipend solves
the first; the escrow and dispute path solve the second. A funder should not have to hand
over the whole budget on trust. The milestone gates solve that.

The dispute path is deliberately conservative. A solo publisher cannot arbitrate their own
commission; the effective quorum is the publication's `arbitrators`, else its admins if at
least two, else the platform `PrintAdmin`. If no one arbitrates, the timeout refunds the
funder. That is not perfect justice; it is a defined default that does not require an
oracle.

## The scaling problem

Escrow is dead money. A desk with several investigations has capital sitting in purses,
unavailable for the next story. The r-sure surface exists for that: `attachCover` records a
Policy on the commission, and the design edge `claimsLoss` would open an r-sure claim on a
breach. The desk can start with escrow and move to cover as its budget grows. The same
publication cell and the same milestones remain.

## The knowledge problem

An investigation's findings are knowledge assets, not just articles. The optional r-gen
surface lets the desk link a validated Claim, KAsset and Provenance record. The desk can
require it for the pieces that make factual claims a reader may want to check. It remains
optional because a writer with a strong archive should not be blocked by a credential flow
on day one.
