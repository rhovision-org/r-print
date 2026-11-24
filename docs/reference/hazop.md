# HAZOP

> **Status:** Internal worksheet, 2026-11-24. A guide-word review, not an
> independent hazard study.

The worksheet is `spec/hazop/worksheet.yaml`; `tools/check_hazop.py` checks the
row schema, the risk arithmetic, the coverage cells and the cross-references.

## Nodes and guide words

| Node | Intent |
|---|---|
| Publication | One cell, publisher-only roster, last-publisher guard, member cap |
| Proposal | Writer proposes, editor accepts, any signer funds once |
| Escrow | Submit/release order, one payment per milestone, terminal conservation |
| Article | Draft → submitted → approved → published; corrections append |
| Edition | Ordered, same-publication, no duplicates, sealed manifest |
| Cover | Active policy, treasury insured, asset match, single assignment |
| Knowledge | Reciprocal chain, validated claim, bound provenance and hash |
| Root/Admin/Payments | Installer registration, admin quorum, nonce, owner-only payment |

The worksheet uses the 15 guide words from the sibling HAZOP method. A cell
with no distinct parameter is `na` with the node's `na_default` reason; the
explicit coverage table records every covered cell.

## Measured shape

| Check | Result |
|---|---|
| Nodes | 8 |
| Guide words | 15 |
| Rows | 32 |
| Negative rows (safeguard holds) | 30 |
| Accepted risks | 2 (cover and knowledge fake chains, RPA-001) |
| Open action | 0; the milestone-binding action (RPA-002 → IMP-002) is fixed |

The two accepted risks are the same capability boundary recorded in
[Object capabilities](object-capabilities.md). The milestone row is `partial`
because the model parameterises the milestone; it is not claimed as a holding
safeguard.

## What the worksheet does not claim

- No independent HAZOP team and no multi-agent blind run.
- No scheduler, liveness or phlo analysis.
- No public testnet or multi-validator evidence.
- A `holds` safeguard is a source reading plus a suite or theorem; it is not a
  formal proof of the deployed term.
