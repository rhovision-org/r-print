# r-print operating notes

Authority order: `contracts/src` and the static gates > `spec/` > `docs/` > this file.

## Platform pitfalls

- **One consumable cell per entity.** A factory creates one contract with one state cell. A
  mutating arm takes the cell, validates, reposts exactly once and replies. A refusal reposts
  the unchanged cell. Never leave a taken cell unreposted.
- **`select` is not committed choice.** The node desugars `select` into parallel `for`s. Never
  use it. `make check-select` fails the build.
- **Deploy term cap is 64 KiB inclusive.** The hard budget is 56 KiB per term. Measure after
  every change.
- **A deploy is atomic, blocks are sequential.** Do not describe a multi-step arm as one comm
  event. Every consumed record must be reposted before the arm replies.
- **Peeks are hints.** Never carry a peeked record across an external await into a write.
  Never use a peek as a lock.
- **Unmatched `for` is silent.** A wrong arity means a deploy that never replies. Match reply
  shapes exhaustively.
- **`*x` sends a name; `@x` sends data.** Pass capabilities with `*`.
- **After value moves, fail.** Return `(false, reason)` only before a withdrawal or deposit.
  Afterwards an unexpected branch calls `1/0` so the deploy rolls back.
- **`rho:block:data` timestamp is the proposer's wall clock.** Use the block height only.
- **No timers.** Expiry is lazy: `expire` and `resolveDispute` are permissionless after a
  block height.
- **Explore-deploy has no block context.** Anything reading `rho:block:data` must be a signed
  deploy.
- **Deploy lifespan is 50 blocks.** Anchor `validAfterBlockNumber` at the tip.
- **Capabilities are resolved per arm.** Use `lib/Resolve.rho`; never capture a resolved
  capability in a bundle or a state map.
- **Canonical masthead binding.** A child factory must check
  `PublicationFactory("issued", publicationId)` and refuse a non-canonical
  `publicationUri`. Never trust a caller-supplied URI.
- **Member identity is derived.** A member's key is its REV address from
  `authOwner(deployerId)`. The publisher adds an address; only that key can act as the member.
- **Solo publications are allowed.** A 1-of-1 publication is valid. Its disputes use the
  publication `arbitrators` set when present, else the platform `PrintAdmin` quorum; a solo
  publisher must not arbitrate their own commission.
- **Finality.** A processed deploy is not success. Require finalized +
  processedWithSuccess + `(true, …)`. Never retry a value-moving deploy with a new op id
  unless the first had no effect.
- **No indexer.** Discovery is a curated catalogue plus links. Factory issuance maps are for
  idempotency and lookup by a known ID, not enumeration.
- **Reuse the sibling primitives.** Escrow is the baseline, not a second insurance engine.
  r-sure owns Slip/Distribution/Policy/Line; r-gen owns Claim/KAsset/Provenance/Identity/
  Credential. r-print reads them by `rho:id:` URI through `05_rgen.rho`/`06_rsure.rho`; the
  siblings never call back into r-print.
- **Name the graph.** Every new mutating or cross-repo arm must add or update a vertex and
  an edge in `spec/graph/`; `make check-graph` fails otherwise.
- **K-Assets are optional.** `Article("attachKnowledge")` links the r-gen chain when the
  publication wants it. `requireKAsset` is an explicit opt-in, never a default gate.
- **Cover is optional.** `CommissionProposal("attachCover")` verifies an r-sure Policy via
  `RsureAdapter("policy")`; the escrow rail remains the default.

## Commands

```
make spec-check      # build, measure, arch, captures, no-select, money, suites, graph, flows, vectors
make measure         # size ledger
make parse-check     # render and parse with the target node's parser
make docs-check      # docs links, orphans, coverage, then mdBook build
make devnet-up       # r-cash devnet via RCASH_DIR/RHOLO_DIR
make rcash-keys      # generate and faucet r-cash keys
make rcash-bootstrap # install the r-cash components r-print needs
make keys install    # copy keys and install r-print
make unit-all        # all 18 behavioural suites
make client-lint client-test client-wasm client-check
make web-install web-test web-build
make check           # spec-check parse-check docs-check client-check
make check-graph     # named integration vertices and edges
```

## Rules for changes

- Every mutating arm needs a refusal test and an idempotency test.
- Every value-moving path needs a balance-conservation assertion.
- After a withdrawal or deposit, an unexpected branch calls `1/0`; never return a refusal with
  value in flight.
- A published article's `contentHash` is frozen. Corrections append; they never rewrite.
- `release` requires a prior `submit`; a milestone pays at most once.
- `cancel`, `expire` and `resolveDispute` refund at most the remaining balance.
- A child contract must be bound to the canonical publication URI.
- Do not claim a suite passes unless `deployments/suite-results.json` records a pass from a
  healthy devnet.
- Mark design-only features `Design intent`; never describe them as implemented.
- The r-sure and r-gen adapters are disabled unless `configs/*.json` sets `enabled: true`
  and a root manifest is present. Do not claim live cover or K-Asset verification otherwise.

## Documentation

- `docs/` is the mdBook source; `docs/book/` is generated and gitignored.
- Stock mdBook only: no mermaid, KaTeX, toc or other preprocessors. Use ASCII diagrams.
- Every `docs/**/*.md` chapter except `SUMMARY.md` must be listed exactly once.
- `reference/` is canonical for arms, schemas, constraints and install order.
- Use relative `.md` links. Never link to generated `docs/book/` paths.
