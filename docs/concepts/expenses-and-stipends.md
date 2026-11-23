# Expenses and stipends

> **Status:** Implemented as milestone kinds in the baseline escrow. Dedicated expense
> receipts are design.

Investigative work has a cash-flow problem before it has a content problem. The writer needs
to eat and sleep while the research happens. A commission that pays only on delivery is a
commission that only wealthy writers can accept.

The baseline models a stipend and an expense as milestone kinds:

| Kind | Intended meaning |
|---|---|
| `stipend` | A research-phase payment, released on a submitted plan or first evidence |
| `draft` | A payment on a first draft |
| `final` | A payment on delivery |
| `expense` | A reimbursement-style milestone for travel, records, or a fixer |
| `bonus` | An editor-awarded bonus at completion |

The contract does not police the semantics of `kind` beyond the whitelist. It validates
`amount > 0`, a deadline, a unique id and a milestone sum equal to the total. The editorial
meaning is a convention the publication's charter and its editors enforce.

## Why the money is still conditional

A stipend is not a grant. It is a milestone in an escrowed commission, so it is released
only when the writer submits evidence and a live editor accepts it. That keeps the funder's
trust: the writer gets living money early, but the publication retains a release gate. If
the work never starts, the funder can cancel before the first release and get the remainder
back; if the deadline passes, anyone can expire the escrow.

## What r-print does not do

It does not store receipts, run a tax calculation, or decide whether a train ticket is a
legitimate expense. Those are publication policies. A fork that needs stronger expense
evidence can anchor the receipt hash in the milestone's `evidenceHash` and read it from the
publication's archive.

The r-gen provenance surface is a natural place to anchor a research trail: an
`Article("attachKnowledge")` link can include a Claim/KAsset/Provenance record for the
published result, while the commission's evidence hashes remain the internal working trail.

## Design extensions

A dedicated expense object (receipt hash, category, approver, reimbursement cap) and a
multi-funder commission are design. They attach to the same `commissionEscrowState` without
changing the milestone release rule.
