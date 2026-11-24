# Audit charter

> **Status:** Internal maintainer review. This is not an independent audit.

The charter defines what the M13 review covers, how a finding becomes a close-out
row, and what the review does **not** claim. The binding records are
`spec/audit/findings.yaml`, `spec/audit/closeout.yaml`,
`spec/audit/improvement-plan.yaml`, `spec/audit/redteam.yaml` and
`spec/hazop/worksheet.yaml`.

## Scope

The review covers four paths:

1. **Publication authority** — roster writes, the last-publisher guard, admin
   nonces, pause scope and the arbitration fallback.
2. **Escrow** — propose, accept, fund, submit, release, cancel, expire,
   dispute and arbitration, including conservation.
3. **Sibling chains** — the r-sure cover and the r-gen Claim → KAsset →
   Provenance → credential link.
4. **Evidence coverage** — the client-op map, which makes every write with no
   live test explicit.

The review used the real-sibling campaign, the guard bridge, the race matrix,
the red-team probes and the HAZOP worksheet. It did not use an external
reviewer, a testnet deployment or a multi-validator campaign.

## Finding lifecycle

A finding has an id (`RPA-###`), a severity (`S1`–`S4`), a likelihood
(`A`–`D`), a risk (`severity × likelihood`), a priority (`P0`–`P2`), evidence,
a claim and a verdict. Every P0 or P1 finding has exactly one terminal
decision in the close-out ledger:

| Decision | Meaning |
|---|---|
| `fixed` | The defect is removed; the row names test, theorem, gate or doc evidence. |
| `risk-accepted` | The risk is documented with a rationale, an owner and an expiry. |
| `narrowed-claim` | The public claim is reduced to what the evidence supports. |

An open P0/P1 is a gate failure, not a note. The improvement plan carries the
M14/M15 actions.

## Independence and limits

`spec/audit/findings.yaml` records a single maintainer and says that independent
technical review has not been performed. The review is therefore **not** an
audit, not a certification and not a production-readiness statement. The Lean
model remains `proved-model` / `proved-conformance`: it is not a refinement of
the deployed Rholang.

The red-team result is an internal probe record. A `fixed` classification means
the intended refusal happened in that run; an `accepted` classification is the
risk-accepted adapter-membership finding, not a pass.

## How to check it

```sh
make check-audit check-closeout check-hazop check-redteam-results
make check-capabilities check-rigor
```

The gates are source-to-register checks. They reject an unstatused divergence,
a P0/P1 without a close-out row, a risk that does not equal severity ×
likelihood, a HAZOP cell without a row or an `na` reason, and a red-team claim
without a recorded result.
