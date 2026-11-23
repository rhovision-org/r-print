# r-print

[Read the book](docs/index.md)

On-chain newspaper and magazine primitives for the [rholo](https://github.com/rhovision-org/rholo)
chain, settled through [r-cash](https://github.com/rhovision-org/r-cash). A publication is an
organisation, a commission is escrowed work with milestones, an article is an editorial record
over a content hash, an edition is an ordered manifest, and corrections are append-only.

> **Status:** Devnet-only, unaudited. 18 behavioural suites pass on a fresh local devnet;
> `make spec-check`, `make parse-check`, `make docs-check` and the Rust client gates pass.
> Escrow is the baseline settlement rail. r-sure cover and r-gen K-Assets are optional
> surfaces, disabled by default. The client layer is live in opt-in live mode: every
> `RprintApi` method is implemented, the key stays in WASM, and writes require finality.
> The recorded live smoke founded a publication with a 2-of-2 admin set, wrote an article
> through its lifecycle, sealed a one-article edition and paused through admin multisig on
> the local 50403 devnet (rholo node build `5b9685e`). The CI dispatch devnet recorded
> 18/18 suites and 11/11 finalized live steps on the pinned node build `e2d073d`.
> A Chromium fixture suite renders every route and every write form with `/api` and `/wasm`
> blocked; a live browser journey records 10 finalized writes and 1 refusal on the local
> devnet. CI dispatch 45270193372 recorded the 27 fixture tests and the 13-step browser
> journey on the pinned node `e2d073d`, alongside 18/18 suites. Subscriptions, revenue
> splits, crowdfunding, reader tips, syndication, the coordination-record contract and the
> Lean model remain design.

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
| Live client | Opt-in browser and CLI operation over a node, with WASM-held keys, finality and multisig |

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
| `crates/` | `rprint-core`, `rprint-keystore`, `rprint-sdk`, `rprint-wallet`, `rprint-cli`, `rprint-wasm` |
| `web/` | React/Vite/TS live client with typed forms for every write and a fixture default |
| `web/e2e/` | Playwright fixture and live browser journeys |
| `docs/` | the 52-chapter mdBook source |

## Quickstart

```sh
make venv
make spec-check        # build, measure, arch, captures, select, placeholders, money, suites, graph, flows, vectors
make parse-check       # needs ../RNodeRust, the rholo node checkout
make docs-check
make client-check      # fmt, clippy, tests, wasm32, wasm-pack, wasm smoke, web tests and build
make web-e2e-install   # one-time Chromium download
make web-e2e-fixture   # browser fixture suite; no node and no WASM
```

Optional devnet campaign:

```sh
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
make client-live      # real WASM signing + HTTP: publication, commission, article, edition, multisig
make cli-live         # CLI read/submit against the same devnet
make web-e2e-live NODE=http://127.0.0.1:40403  # real Chromium browser journey
```

The measured contract campaign on 2026-11-23 passed all 18 suites on a local single-validator
devnet (rholo node 0.1.0 build `8fe0136`). The live client smoke was recorded later on the
local 50403 devnet (node build `5b9685e`): 11 steps, 11 finalized deploys. The CI dispatch
devnet on the pinned node build `e2d073d` recorded 18/18 suites and 11/11 finalized live
steps. The browser fixture suite records 27 tests over two projects; the browser live
journey recorded 13 steps, 10 finalized writes and 1 refusal locally and in the CI dispatch
run 45270193372. There is no claim of a public testnet or audited deployment.

## The graph

`spec/graph/vertices.yaml` and `spec/graph/edges.yaml` name every vertex and edge, and
`docs/reference/integration-graph.md` explains them. Examples: `Commission --funds--> Escrow`,
`Commission --covers--> Policy`, `Article --wraps--> KAsset`, `Provenance --anchorsHash--> Article`,
`Member --identifiedBy--> Identity`. The r-sure and r-gen adapters read entities by `rho:id:`
URI; neither sibling ever calls back into r-print.

## Live client

The client stack is horizontal over every existing primitive. `rprint-wallet` holds the
key, signs deploys, signs canonical admin/edition payloads and decodes replies.
`rprint-sdk::build_term` is the single Rholang entry point. `rprint-wasm` exposes the same
surface to the browser, where the key never leaves WASM. The CLI adds live `read`/`submit`,
and the web client maps every `RprintApi` method to a typed form.

- **Reads** use explore-deploy and reply on the term's first private name.
- **Writes** are signed deploys and succeed only after processed-with-success **and**
  finality **and** a `(true, …)` reply. A `(false, reason)` reply is a refusal, not an error.
- **Fixture mode is the default** for tests, CI and the book. Live mode is opt-in in Network
  settings (`VITE_RPRINT_MODE=live`) and needs a running node, a root URI, and a funded
  wallet.
- **Multisig** collects signatures one keystore at a time over the payload fetched from the
  deployed `Codec`; the client never joins admin keys by hand.
- **Browser e2e** runs every route and form in Chromium in fixture mode with the node and
  WASM blocked, and runs one real browser journey against a devnet in live mode.
- **No indexer.** Discovery is a local catalogue of links and share URIs.

Commission funding still assumes an r-cash-funded account; the devnet faucet only fills the
native REV vault used for phlo.

## Documentation

`docs/` is the mdBook source; `docs/book/` is generated. Use `make docs`, `make docs-serve`
and `make docs-check` (mdBook 0.5.4+). The live client guide is
[Run the live client](docs/guides/run-live-client.md).

## License

AGPL-3.0-or-later. See `LICENSE` and `THIRD_PARTY_NOTICES.md`. Running a modified version as
a network service carries the AGPL §13 source-offer obligation. No real funds; not legal or
financial advice.
