# r-print

[Read the book](docs/index.md)

On-chain newspaper and magazine primitives for the [rholo](https://github.com/rhovision-org/rholo)
chain, settled through [r-cash](https://github.com/rhovision-org/r-cash). A publication is an
organisation, a commission is escrowed work with milestones, an article is an editorial record
over a content hash, an edition is an ordered manifest, and corrections are append-only.

> **Status:** Devnet-only, unaudited. 18 behavioural suites pass on a fresh local devnet;
> `make spec-check`, `make parse-check`, `make docs-check` and the Rust client gates pass.
> Escrow is the baseline settlement rail. r-sure cover and r-gen K-Assets are optional
> surfaces, disabled by default. Subscriptions, revenue splits, crowdfunding, reader tips,
> syndication, the coordination-record contract and the Lean model are design.

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
| Publication | Masthead, charter, roster, roles, solo mode and editorial authority |
| Commission | Proposal, editorial acceptance and escrowed milestone funding |
| Escrow | Baseline release, cancel, expire, dispute and arbitration |
| Article | Content-hash lifecycle, review attestations and append-only corrections |
| Edition | Ordered, editor-signed manifest of published articles |
| r-sure surface | Optional Policy cover attached to a commission; escrow at scale becomes dead money |
| r-gen surface | Optional Claim → KAsset → Provenance link on an article; not a gate |
| Integration graph | Named vertices and edges across r-print, r-sure, r-gen, r-cash, BYOID and quantum-os |

Escrow is the smallest thing that works and stays the default. A publication can attach an
r-sure Policy when it wants proper insurance that scales. K-Assets are optional because
writers are used to publishing with a content hash; a publication can opt into `requireKAsset`
or link the r-gen chain with `attachKnowledge` when it wants stronger credibility.

There is no backend, indexer or off-chain database. Content stays off-chain; the chain stores
hashes, authority records and optional sibling URIs.

## Repository map

| Path | Contents |
|---|---|
| `contracts/src/deploy/` | 13 numbered deploy terms |
| `contracts/src/lib/` | build-time fragments |
| `harness/` | installer, fixtures, 18 behavioural suites |
| `spec/graph/` | the named integration graph (`make check-graph`) |
| `spec/` | invariants, acceptance, flows, vectors and design-only surfaces |
| `crates/` | `rprint-core`, `rprint-keystore`, `rprint-sdk`, `rprint-cli`, `rprint-wasm` |
| `web/` | React/Vite/TS full-surface sketch with typed stubs |
| `docs/` | the 50-chapter mdBook source |

## Quickstart

```sh
make venv
make spec-check        # build, measure, arch, captures, select, placeholders, money, suites, graph, flows, vectors
make parse-check       # needs ../RNodeRust, the rholo node checkout
make docs-check
make client-check      # fmt, clippy, tests, wasm32
```

Optional devnet campaign:

```sh
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
```

The measured campaign on 2026-11-23 passed all 18 suites on a local single-validator devnet
(rholo node 0.1.0 build `8fe0136`). There is no claim of a testnet or audited deployment.

## The graph

`spec/graph/vertices.yaml` and `spec/graph/edges.yaml` name every vertex and edge, and
`docs/reference/integration-graph.md` explains them. Examples: `Commission --funds--> Escrow`,
`Commission --covers--> Policy`, `Article --wraps--> KAsset`, `Provenance --anchorsHash--> Article`,
`Member --identifiedBy--> Identity`. The r-sure and r-gen adapters read entities by `rho:id:`
URI; neither sibling ever calls back into r-print.

## Documentation

`docs/` is the mdBook source; `docs/book/` is generated. Use `make docs`, `make docs-serve`
and `make docs-check` (mdBook 0.5.4+).

## License

AGPL-3.0-or-later. See `LICENSE` and `THIRD_PARTY_NOTICES.md`. Running a modified version as
a network service carries the AGPL §13 source-offer obligation. No real funds; not legal or
financial advice.
