# Commission an investigation

> **Status:** Implemented. The commission, commission_dispute and conservation suites cover
> this chapter.

Cora pitches a story about a municipal contract. She wants a stipend for three weeks of
records work and a final payment on delivery. Ada agrees to fund it from the publication's
account.

## The proposal

Cora calls `CommissionFactory("propose")` with:

```text
publicationId    pub:ledger
publicationUri   the canonical URI from PublicationFactory("issued")
writerDid        did:byoid:cora
titleHash        hash of the pitch title
briefHash        hash of the brief
total            1000
milestones       [ {id: m1, kind: stipend, amount: 400, deadlineHeight: 2700},
                   {id: m2, kind: final,   amount: 600, deadlineHeight: 2800} ]
graceBlocks      10
disputeWindow    10
```

`Terms("commission")` accepts the milestones because the ids are distinct, the amounts are
positive, the sum is 1000 and there are no more than eight. The factory checks that the
publication URI is canonical and the publication is active.

## Accept and fund

Bram, the editor, calls `accept`. The proposal records him as the accepted editor and moves
to `accepted`. Ada calls `fund`; the escrow factory withdraws 1000 REV from Ada's r-cash
account into a purse held by the escrow. The proposal moves to `funded`.

Cora is now added as a `contributor` so the article factory will accept her as an author.

## The milestones

Cora submits `m1` with an evidence hash for her records request and first interviews. Bram
releases it; 400 REV moves to Cora's account. She submits `m2` with the final draft hash;
Bram releases it; 600 REV moves and the escrow status becomes `completed` with an empty
purse.

If Bram had tried to release `m2` before `m1`, the escrow would refuse with `milestone`.
If Cora had missed the deadline plus grace, `submit` would refuse with `too late`. If the
work stalled, Ada could `cancel` before the first release or anyone could `expire` after the
hard deadline; the remainder would return to Ada.

## The dispute branch

Suppose Bram and Cora disagree about the final draft. Cora calls `dispute`; submit, release
and cancel freeze. Ada and Cora can settle off-chain, or an arbitrator calls `arbitrate`
with `writerBps`. Because Ada is solo, the effective quorum is the platform `PrintAdmin`;
the split is paid from the remaining balance and the escrow becomes `arbitrated`. If nobody
arbitrates, `resolveDispute` after the window refunds the remainder to Ada.

## The cover option

Ada could attach an r-sure Policy to the commission with `attachCover`. The proposal verifies
the policy through `RsureAdapter("policy")` and stores its status. The baseline escrow does
not change. For the next, larger investigation, Ada may do this instead of leaving the whole
risk in escrow.
