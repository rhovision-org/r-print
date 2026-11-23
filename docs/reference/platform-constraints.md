# Platform constraints

> **Status:** Implemented constraints. The static gates enforce the mechanical ones.

| Constraint | Value | Consequence |
|---|---|---|
| Deploy term cap | 64 KiB inclusive | Hard budget 56 KiB per term |
| Parser depth | 128 | Project budget 96 |
| `select` | desugared to parallel `for`s | Never use it for exclusivity |
| Timers | none | Deadlines are block heights; expiry is lazy |
| Block timestamp | proposer wall clock | Use the block height only |
| Deploy lifespan | 50 blocks | Anchor `validAfterBlockNumber` at the tip |
| Explore deploy | no block context, no deployer | Anything reading block data must be signed |
| Unmatched `for` | silent hang | Match reply shapes exhaustively |
| `*x` vs `@x` | name vs data | Pass capabilities with `*` |
| State cell | one writer | Consume, validate, repost once |
| Capability in state | forbidden | Keep purses and tokens in closures |
| Integer money | required | No floats; bps denominator 10000 |

## Size strategy

`10_publication.rho` and `11_publication_cell.rho` are split to keep the factory and the
cell under budget. `21_commission_escrow.rho` is the largest term; if a fork adds arms,
measure after every change and split a helper into `contracts/src/lib/`. The current
measurements are in `contracts/measure.json`.

## Finality

A processed deploy is not success. Require finalized + processedWithSuccess + `(true, …)`.
Never retry a value-moving deploy with a new op id unless you proved the first had no effect.
The suites use the harness client, which waits for the processed result; finality semantics
belong to the r-cash client and the node.

## Node variance

The recorded campaign used rholo node `0.1.0` build `8fe0136`. A different node may parse or
reduce differently. The parser gate is the target node's own parser, not a Python
approximation. A not-run suite is not a pass.
