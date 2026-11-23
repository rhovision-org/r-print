# r-print

[Read the book](docs/index.md)

On-chain newspaper and magazine primitives for the [rholo](https://github.com/rhovision-org/rholo)
chain, settled through [r-cash](https://github.com/rhovision-org/r-cash). A publication is an
organisation, a commission is escrowed work with milestones, an article is a provenance
record, an edition is an ordered manifest, and corrections are append-only.

> **Status:** v0.1 foundation in progress. Devnet-only, unaudited. Do not put real value on
> it. Subscriptions, revenue splits, crowdfunding, the Lean model and the working web client
> are specified but not implemented.

## Why

Independent media is atomised. The cost of organising is high, so writers work as
contractors and brands collapse into personal brands. Subscription tools give individuals a
revenue rail but no business logic for a small or medium publication to act as an
organisation: no roster, no editorial authority, no commissioned-work escrow, no provenance,
no corrections record, no reader-revenue split. Investigative work is the hardest case: it
needs sunk-cost investment and living expenses before it can be sold.

r-print supplies that missing business logic as small, auditable primitives.

## What is here

| Primitive | What it does |
|---|---|
| Publication | Masthead, charter, roster, roles and editorial authority |
| Commission | Proposal, editorial acceptance and escrowed milestone funding |
| Article | Content-hash provenance, bylines, review attestations and lifecycle |
| Edition | Ordered, editor-signed manifest of published articles |
| Correction | Append-only corrections, clarifications and retractions |
| Coordination | Interface-only anchor for BYOID identities and quantum-os outcomes |

There is no backend, indexer or off-chain database. Content stays off-chain; the chain stores
hashes and authority records.

## Quickstart

```sh
make venv
make spec-check
make parse-check      # needs ../RNodeRust, the rholo node checkout
make docs-check
make client-check     # Rust, WASM and the web sketch
```

Optional devnet campaign:

```sh
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
```

## Repository map

| Path | Contents |
|---|---|
| `contracts/src/deploy/` | 11 numbered deploy terms |
| `contracts/src/lib/` | build-time fragments |
| `harness/` | installer, fixtures, behavioural suites |
| `crates/` | `rprint-core`, `rprint-keystore`, `rprint-sdk`, `rprint-cli`, `rprint-wasm` |
| `web/` | React/Vite/TS full-surface sketch with typed stubs |
| `spec/` | invariants, acceptance, flows and vectors |
| `docs/` | the mdBook source |

## Documentation

`docs/` is the mdBook source; `docs/book/` is generated. Use `make docs`, `make docs-serve`
and `make docs-check` (mdBook 0.5.4+).

## License

AGPL-3.0-or-later. See `LICENSE` and `THIRD_PARTY_NOTICES.md`. Running a modified version as
a network service carries the AGPL §13 source-offer obligation. No real funds; not legal or
financial advice.
