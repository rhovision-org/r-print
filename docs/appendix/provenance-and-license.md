# Provenance and license

> **Status:** Reference. This page describes the repository's own provenance, not a legal
> opinion.

r-print is AGPL-3.0-or-later. The full text is in `LICENSE`; the third-party notices are in
`THIRD_PARTY_NOTICES.md`. Running a modified version as a network service carries the AGPL
§13 source-offer obligation.

## Borrowed patterns

The repository follows the r-* house conventions and reuses architectural patterns from:

| Project | Commit | What was reused |
|---|---|---|
| r-share | `7114acb` | Root/kernel/admin/payments plumbing, harness, tooling |
| r-cash | `49b441d` | Signed-deploy and payment crates |
| rholo | `841cb84` | `rchain-crypto` and the node parser |
| r-chain-rust | `e2d073d` | Development node and parser CI |

The r-gen and r-sure primitives are referenced through adapter surfaces; their code is not
vendored. `configs/rgen.json` pins r-gen `bcc840c`; `configs/rsure.json` pins r-sure
`0da5d04`.

## Content and hashes

The repository contains no article content. The contracts store hashes and URIs. A fork's
archive is the content-availability layer. The book itself is AGPL-3.0-or-later like the
code.

## No real value

r-print is devnet-only and unaudited. No contract in this repository should be used with
real value. The license does not change that warning, and the warning is not a warranty.
