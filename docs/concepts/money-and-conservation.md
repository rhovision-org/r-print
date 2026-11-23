# Money and conservation

> **Status:** Implemented. The conservation suite passes with a closed balance set.

Money is integer minor units. There are no floats, no percentages as decimals and no
wall-clock deadlines. A commission's `total` is the sum of its milestone amounts, validated
before funding; the escrow holds exactly that amount in one purse.

## The closed set

The conservation suite tracks a closed set: the funder's r-cash account, the writer's
account, the platform account and the escrow purse. Funding happens before the first
snapshot. Every terminal path must leave the sum constant and the purse empty.

| Path | Expected movement |
|---|---|
| Release a milestone | purse → writer, by milestone `amount` |
| Release the last milestone | status `completed`, purse zero |
| Cancel | purse → funder for the remainder |
| Expire | purse → funder for the remainder |
| Arbitrate | purse → writer and funder by `writerBps`, remainder split exactly |
| Resolve a dispute by timeout | purse → funder for the remainder |

Terminal accounting is `paidWriter + refundedFunder == total`. The escrow records both
counters; a replay returns the stored reply and moves nothing.

## What the contract enforces

- `Terms("commission")` refuses a zero/negative amount, a duplicate milestone id, more than
  eight milestones, a total above 1e12 minor units, or a milestone sum not equal to the
  total.
- `release` refuses a milestone that is not `submitted`, and refuses out-of-order release.
- `cancel`, `expire` and `resolveDispute` refund at most the remaining balance.
- After a withdrawal or deposit, an unexpected branch calls `1/0`; a refusal with value in
  flight is not returned.

## What it does not enforce

The asset is REV in v0.1. There is no fee-on-transfer token, no rebasing asset and no
multi-asset purse. The platform fee is zero in the baseline; the state has a `fee` field for
a later version. A conservation proof is a test result, not a formal refinement.

## The r-sure view

r-sure's conservation model adds the Slip's funded premium and the syndicate/line balances
to the closed set. r-print's baseline does not include those vertices until a publication
enables the r-sure surface. See [the integration graph](../reference/integration-graph.md)
for the edges `funds`, `escrows`, `refunds`, `distributes` and `settles`.
