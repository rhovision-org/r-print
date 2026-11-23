# Verification

> **Status:** The measured v0.1 campaign. This is a local devnet result, not an audit.

## The recorded campaign

On the local 50403 devnet, the full **18/18** behavioural suites passed in one run:

```
admin, admin_keys, article, article_refusals, behavior, commission,
commission_dispute, commission_refusals, conservation, corrections, edition,
interfaces, membership_auth, pause_scope, payments, publication, root, schema
```

The node reported `rholo node 0.1.0` build `8fe0136`. The r-cash components were installed
from the pinned commit `49b441dea4f5561992387ed670ab263fcd5dd164`. The suite results are
written to `deployments/suite-results.json` and are gitignored.

## Static and parser gates

| Gate | Result |
|---|---|
| `make spec-check` | build, measure, architecture, captures, `select`, placeholders, money, suites, graph |
| `make parse-check` | every built and rendered term parses with the target node parser |
| `make docs-check` | SUMMARY coverage, links, orphans, component coverage, install keys, mdBook build |
| `make client-check` | Rust fmt/clippy/tests, wasm32 check, web typecheck/test/build |
| `make check-graph` | 25 vertices, 36 edges (14 implemented, 14 surface, 8 design) |

## What the suites actually assert

- **publication / membership_auth / admin_keys**: charter validation, roster writes,
  impersonation refusal, last-publisher rule, member cap, solo and multi arbitration,
  admin-key thresholds.
- **commission / refusals / dispute / conservation**: propose → accept → fund, milestone
  submit/release, out-of-order and double-release refusals, cancel/expire, platform-
  fallback arbitration, timeout refund, a closed balance set.
- **article / article_refusals / corrections**: lifecycle, fact-check attestation, optional
  K-Asset links, `requireKAsset`, author/editor refusals, append-only corrections and
  retraction.
- **edition / behavior**: ordered append, duplicate/draft refusals, editor-signed seal,
  post-seal refusal, and the small-newsroom golden transcript.
- **interfaces / pause_scope**: adapters disabled by default, mock Claim/KAsset/Provenance
  reads, publication pause blocking new work while existing escrow releases continue.

## What is not verified

- No public testnet or mainnet run.
- No audit, no penetration test, no formal refinement.
- No r-sure or r-gen root enabled in the recorded campaign; the adapters were disabled and
  the optional surfaces were exercised with mock entity contracts.
- No multi-validator finality campaign.
- The web client is a sketch; the Rust client is a term builder.

## How to reproduce

```sh
make venv
make spec-check
make parse-check
make docs-check
make client-check
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
```

A suite that cannot reach a healthy devnet reports `not_run`, never a pass. Report the actual
node build if it differs from `8fe0136`.
