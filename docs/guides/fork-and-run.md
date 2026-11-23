# Fork and run

> **Status:** Implemented. This is the v0.1 local path.

## Prerequisites

- Rust `1.95.0` (the workspace toolchain)
- Python 3.12 for the harness
- Docker for the devnet
- `mdbook` for the book
- Lean 4.12 via `elan` for the formal model (`elan toolchain install
  leanprover/lean4:v4.12.0`)
- sibling checkouts of r-cash (`../Rholphin` by default) and the rholo node
  (`../RNodeRust` by default)

The workspace pins r-cash at `49b441d` and `rchain-crypto` at rholo `841cb84`. The local node
checkout used for the recorded campaign was rholo node `0.1.0` build `8fe0136` on port
50403.

## Static gates

```sh
make venv
make spec-check
make parse-check
make docs-check
make formal-check
make client-lint client-test client-wasm
```

`spec-check` builds the inlined terms, measures them, checks the component graph, refuses
`select`, refuses forbidden bundle captures, checks integer money and suite mapping, and runs
`tools/check_graph.py`. `parse-check` renders the terms with the installer and parses them
with the target node's parser.

## Devnet

```sh
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
```

`devnet-up` delegates to the r-cash devnet. `rcash-keys` funds the deployer; `rcash-bootstrap`
installs the r-cash components the r-print payments adapter resolves. `keys install` copies
the key file and installs the 13 r-print terms.

If you already run a devnet on a non-default port, pass `RPRINT_NODE`, `RPRINT_ADMIN` and
`RPRINT_CONTAINER` to the harness. The install and suite commands honour them.

## A second, isolated network

The rholo devnet launcher supports a prefix and a separate network. A measurement or a fork
can run beside an existing devnet without touching its containers. The r-print harness only
needs the node URL, admin URL and the container name used to sign deploys.

## What to copy

A fork that wants the primitives keeps:

- `contracts/src/deploy/` and `contracts/src/lib/`
- `harness/` (installer, fixtures, suites)
- `tools/` (build, measure, checks, parser)
- `spec/` (invariants, graph, vectors)
- `crates/` (core, SDK, keystore, CLI, WASM)
- `web/` (opt-in live client; fixture default)

Change the publication product name, the charter policy and your archive. Do not change the
cell doctrine or the canonical publication binding.
