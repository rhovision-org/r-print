# Commission escrow

> **Status:** Implemented baseline; r-sure cover is an optional surface. The commission,
> commission_refusals, commission_dispute and conservation suites pass.

A commission is a promise with money behind it. The baseline rail has one purse, a list of
milestones, a release rule and a refund rule. The r-sure surface sits above it for
publications that want proper insurance at scale.

## Proposal before money

`CommissionFactory("propose", dId, opId, proposalId, data)` creates one
`CommissionProposal`. The writer must be the deployer; the publication must be canonical
and active; `Terms("commission")` validates the milestones, amounts and deadlines. The
proposal starts `proposed`.

An editor or publisher calls `accept`; the proposal becomes `accepted` and records the
accepted editor. No money has moved. A writer or the accepted editor can `cancel` before
funding.

## Funding and custody

`CommissionEscrowFactory("createFunded", dId, opId, proposalId, proposal)` is called from
the proposal's `fund` arm. It:

1. checks the proposal is accepted and the accepted editor is still live;
2. creates an ERTP purse through r-cash `Payments`;
3. withdraws the total from the funder's r-cash account and deposits it into the purse;
4. spawns one `CommissionEscrow` with the purse, the milestones and a hard deadline.

The escrow state is `commissionEscrowState`: `total`, `milestones`, `paidWriter`,
`refundedFunder`, `hardDeadlineHeight`, `status`, `dispute`, `ops`, `nonce`. The purse is
held in the contract closure, never in the state map.

## Milestones

Each milestone has `id`, `kind`, `amount`, `deadlineHeight`, `status`, `evidenceHash`,
`submittedAtHeight` and `releasedAtHeight`.

- `submit` is writer-only, before `deadlineHeight + graceBlocks`, for a `pending` milestone.
- `release` is editor/publisher-only, for a `submitted` milestone, and requires every prior
  milestone to be released. It pays the writer and marks the milestone `released`.
- `reimburse`-style expenses are modelled as a milestone of kind `expense`; the baseline
  escrow treats all kinds the same.
- When every milestone is released the status becomes `completed`.

## Failure paths

| Arm | Who | Effect |
|---|---|---|
| `cancel` | funder or live editor/publisher | Refunds the remaining balance to the funder |
| `expire` | permissionless after `hardDeadlineHeight` | Refunds the remaining balance |
| `dispute` | writer or funder | Freezes submit/release/cancel and records a reason |
| `arbitrate` | adaptive quorum | Splits the remaining balance by `writerBps` |
| `resolveDispute` | permissionless after the dispute window | Conservative refund to the funder |

The adaptive quorum is the publication's `arbitrators` if set, else its admins if at least
two distinct keys, else the platform `PrintAdmin`. A solo publisher cannot arbitrate their
own commission. The conservation suite asserts a closed set: `paidWriter + refundedFunder
== total` at a terminal state and an empty purse.

## The r-sure surface

Escrow is the baseline because it is simple and auditable. It is also dead money at scale.
`CommissionProposal("attachCover", dId, opId, coverUri)` verifies an r-sure Policy through
`RsureAdapter("policy")` and records `coverUri` and `coverStatus`. This is a real surface,
not a promise: the commission can carry a policy reference without changing escrow
semantics. Opening an r-sure claim on a breach is a design edge (`claimsLoss`), because it
needs the policy token holder; see [the integration graph](../reference/integration-graph.md).
