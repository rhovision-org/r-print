# r-print operating notes

Authority order: `contracts/src` and the static gates > `spec/` > `docs/` > this file.

## Repository map

| Path | Contents |
|---|---|
| `contracts/src/deploy/` | 13 numbered Rholang deploy terms and the shared library fragments |
| `harness/` | installer, fixtures and 19 behavioural suites |
| `spec/lean/` | Lean 4.12 model, axiom audit, vectors and `Model/System.lean` boundary |
| `spec/graph/` | the named integration vertices and edges |
| `spec/flows/` | the arm and invariant manifest, including `lean`/`lean_status` |
| `crates/` | Rust core, keystore, SDK, wallet, CLI and WASM facade |
| `web/` | React/Vite/TS live client; `web/e2e/` is the Playwright layer |
| `docs/` | the 53-chapter mdBook source |

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

## Sibling surfaces

- **Optional, opt-in, fail closed.** `configs/rsure.json` and `configs/rgen.json` keep
  `enabled: false`. `make install-with-siblings` (`--siblings` / `RPRINT_SIBLINGS=1`) requires
  both manifests and fails the install when one is missing; `RPRINT_SIBLINGS_DIR` overrides
  the parent checkout directory and `RPRINT_RGEN_MANIFEST`/`RPRINT_RSURE_MANIFEST` override a
  manifest path.
- **One key file.** The sibling harnesses read `RSHARE_KEYS` (r-sure) and `RGEN_KEYS` (r-gen);
  both point at the r-print `.devnet/keys.json`. This is what lets the r-gen claimant and
  provenance writer be the article author. The r-gen issuer is `deployer`; validators are
  distinct keys.
- **Cover chain.** `attachCover` requires an active policy, `insured == charter.treasuryAccountId`,
  `assetId == charter.assetId`, and refuses a different overwrite. An identical attach is a
  replay. Record `coverAssetId`, `coverPerClaimLimit`, `coverAggregateRemaining`, `coverInsured`;
  read them through `coverInfo`.
- **Knowledge chain.** `attachKnowledge` accepts `submitted`/`approved` only and verifies the
  reciprocal Claim ↔ KAsset references, a validated/conditional claim, the provenance asset
  and claim binding, the anchored content hash, the author match, and an active unexpired
  credential when supplied. It is single-assignment. `provenanceInfo` returns the provenance
  state; an empty URI refuses `"uri"`.
- **Two root APIs.** r-gen's root `resolve` is `(key, ret)`; r-sure's is
  `(key, minVersion, ret)`. Do not copy one adapter's call shape into the other.
- **r-gen values are `Uri`.** A KAsset/Claim/Provenance state field is a Rholang `Uri`, not a
  String. Normalise with `.toString()` before comparing it to a client-supplied `rho:id:`
  string; otherwise the comparison is always false.
- **Credential lifecycle.** Read `Credential("get")` for `status` and `expiresAt`. The
  factory `verify` arm returns the issuance record, which carries neither field.
- **Subprocess fixtures.** Never import a sibling harness in-process; `actors`, `deploy` and
  `preflight` collide. Run `sibling_rsure_driver.py` and `sibling_rgen_driver.py` in a
  subprocess and cache the result in `deployments/sibling-fixture.json`. The 2026-11-24 local
  campaign recorded 2/2 suites and 41 assertions; the CI artifact is pending.
- **No fake live knowledge.** The fresh WASM wallet cannot sign the r-gen claimant. The web
  live smoke covers `attachCover` only; the CLI live test covers both. Do not weaken the author
  check to make a browser demo pass.

## Live client

- **Two term shapes.** Reads use `explore_call_term` (reply on the first private name,
  `return`); writes use `call_term` (reply on `deployId`). Explore-deploy does not expose a
  `deployId` reply. Never use the write shape for a live read.
- **Finality.** A write is a success only after processedWithSuccess + finalized + a
  `(true, …)` reply. A `(false, reason)` reply is a refusal, not an error. A processed deploy
  that never finalizes is an error, never a success.
- **Key only in WASM.** `rprint-wallet` is the only place a key is held. The wasm facade
  returns the encrypted keystore and wallet metadata, never a plaintext secret.
- **`build_term` is the only term source.** TypeScript forms send a `TermRequest`; do not
  hand-write Rholang in the browser. Rust tests pin every op's arm.
- **Retry rule.** An ambiguous submit keeps the same op id and preferably polls the deploy id
  or re-POSTs the same signed body; never use a fresh op id. A new op id requires confirming
  the first had no effect.
- **Multisig.** Fetch the payload from the deployed `Codec`; sign it with one temporary wallet
  per signer; never hold two secrets at once. The contract counts distinct keys.
- **Fixture default.** Tests, CI and the book must work with no node. Live mode is opt-in.
- **Funding precondition.** The faucet fills the native REV vault for phlo; commission funding
  additionally needs an r-cash-funded account. The Network page's live-only deposit action
  moves REV from that vault into the account with the shared `rcash_deposit_term`. The deposit
  is value-moving and has no contract op id: after a timeout, check the deploy id; never
  resubmit the same deposit. Say so; do not hide precharge failures.
- **Browser e2e.** The fixture suite blocks `/api` and `/wasm`; it must pass with no node and
  no generated WASM. The live suite uses one browser context, hash navigation after the
  initial load (a document reload locks the WASM wallet), state waits and no
  `page.waitForTimeout`. Select forms by `data-testid` and controls by accessible role; do not
  use CSS classes. A live browser claim needs `deployments/browser-e2e-results.json` and the
  CI artifact.

## Formal model

- **`proved-model` is the ceiling.** `spec/lean/` is a self-contained Lean 4.12 project with
  no Mathlib and an empty package manifest. Its theorems are about the shallow state machines,
  not a refinement of the deployed Rholang.
- **No escapes.** No `sorry`, `admit`, `axiom` or `native_decide`; only `propext`,
  `Classical.choice` and `Quot.sound` are accepted. `make lean-check` builds and audits every
  theorem named in `RPrint/Audit.lean`.
- **Every core arm names a theorem.** Add `lean`/`lean_status` to `spec/flows/core.yaml`; a
  core arm must be `proved-model`. An arm without a theorem is `owed`, never proved.
  `make check-flows-strict` rejects a `proved-model` target that is a `def` or constructor.
- **Aliases are for docs.** `RPrint/Invariants.lean` holds stable `I`-names; the flow manifest
  must point at the carrying theorem, not an alias.
- **Vectors are generated.** `spec/vectors/lean.json` comes from `RPrint/Emit.lean`; run
  `make lean-vectors-write` after an intentional transition change and commit the result.
  Never hand-edit it. Canonical payload vectors stay in `core.json` and `client.json`.
- **Boundary assumptions are explicit.** ERTP purse atomicity, phlo, cryptography, node
  scheduling, deploy atomicity and the cross-contract ties live in
  `RPrint/Model/System.lean`; they are not theorems.
- **Guard bridge.** Every mutating cornerstone arm needs a row in
  `spec/guards/arms.yaml` and a `guard_eq` theorem (or `owed` with a note). The bridge
  checks source atoms, the atom partition and the flow entry; it is a drift check, not an
  extraction.
- **Race matrix.** Every core arm pair needs a row in `spec/flows/races.yaml`. Use `owed` with
  a note when the shallow model cannot support the claim; never write a false pair theorem.
  The matrix is pair-level, not scheduler-level race freedom.
- **Conformance bundle.** `proved-conformance` requires all three legs: a theorem, a
  Lean-emitted `spec/vectors/core.tsv` row and a suite assertion for the same case id. Promote
  an arm only when all three exist. `make check-conformance` rejects a partial bundle.
- **Rigor ledger.** Every invariant, boundary assumption, material divergence and public
  claim needs a row in `spec/proofs/rigor.yaml`. `proved` needs a theorem; narrower/partial
  needs a gap; mechanism/assumption/design needs evidence and a note. A material divergence
  needs a roadmap closure.
- **No inflated claim.** Never write "verified", "audited", "proved about the deployed
  Rholang" or "proved-tied" for this model. The audit ledgers are an internal maintainer
  review, not an independent audit.

## Commands

```
make spec-check      # build, measure, arch, captures, no-select, money, suites, graph, flows, vectors
make measure         # size ledger
make parse-check     # render and parse with the target node's parser
make docs-check      # docs links, orphans, coverage, then mdBook build
make lean-build      # lake build
make lean-check      # build, proof-escape scan and axiom audit
make lean-vectors    # compare spec/vectors/lean.json with a fresh emission
make lean-vectors-write # regenerate the Lean vector corpus
make check-flows-strict # every core arm names a proved-model theorem
make formal-check    # lean-check, lean-vectors, core-vectors, check-flows and strict
make check-guard-bridge check-race-matrix check-rigor check-conformance
make check-core-vectors check-client-ops check-capabilities check-schemas
make check-arm-inventory check-audit check-closeout check-hazop check-redteam-results
make redteam         # adversarial probes; writes deployments/redteam-results.json
make devnet-up       # r-cash devnet via RCASH_DIR/RHOLO_DIR
make rcash-keys      # generate and faucet r-cash keys
make rcash-bootstrap # install the r-cash components r-print needs
make keys install    # copy keys and install r-print
make siblings-venv   # install the pinned sibling harness requirements
make siblings-install # install r-sure and r-gen with the shared key file
make install-with-siblings # enable both roots and install r-print
make sibling-fixture # write deployments/sibling-fixture.json
make sibling-suites-strict # unit_cover and unit_knowledge
make unit-all        # all 19 behavioural suites
make client-lint client-test client-wasm client-check
make client-wasm-pack client-wasm-node client-wasm-smoke
make client-live     # full WASM client journey; needs RPRINT_SIBLINGS=1 and the fixture
make cli-live        # CLI read/submit against the same devnet
make web-install web-test web-build
make web-e2e-install web-e2e-fixture web-e2e-live
make check           # spec-check parse-check docs-check formal-check client-check
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
- A new mutating arm either names a Lean theorem in `spec/flows/core.yaml` or is marked
  `lean_status: owed`. A behaviour change that touches a modelled transition updates the
  Lean module, its audit line, the flow rule and the vector corpus together.
- Do not claim a suite passes unless `deployments/suite-results.json` records a pass from a
  healthy devnet.
- Mark design-only features `Design intent`; never describe them as implemented.
- The r-sure and r-gen adapters are disabled unless `configs/*.json` sets `enabled: true`
  and a root manifest is present. Do not claim live cover or K-Asset verification otherwise.
- Do not claim a live-client method was exercised against a devnet unless
  `deployments/live-client-results.json` records a pass. Fixture/unit coverage is not a live
  run.
- Do not claim the live browser journey passed unless
  `deployments/browser-e2e-results.json` records a pass and the CI job uploaded the
  Playwright report. The fixture browser suite is not a live run.
- Capability-valued `Payments` arms (`accountOf`, `depositFacet`, `refundPayment`) and
  installer `PrintRoot`/`PrintAdmin` writes are not standalone browser operations. They are
  print-only or operator surfaces.

## Documentation

- `docs/` is the mdBook source; `docs/book/` is generated and gitignored.
- Stock mdBook only: no mermaid, KaTeX, toc or other preprocessors. Use ASCII diagrams.
- Every `docs/**/*.md` chapter except `SUMMARY.md` must be listed exactly once.
- `reference/` is canonical for arms, schemas, constraints and install order.
- `reference/formal-model.md` is canonical for the Lean model, its status labels and its
  boundary; `reference/status-vocabulary.md` carries the formal labels.
- Use relative `.md` links. Never link to generated `docs/book/` paths.

## Definition of done

- The contract, flow, Lean, docs and client gates for the change have run, or the report says
  explicitly which could not run. Do not report an unrun check as passing.
- A behaviour change updates the contract, `spec/flows/core.yaml`, the Lean model when the
  obligation changes, and the docs in that order.
- The final report states the measured counts and the exact node/build or CI run; it does not
  invent them.
- `proved-model` is reported as `proved-model`, never as an audit or a refinement.
- A sibling-surface claim needs `deployments/sibling-suite-results.json` (or the CI artifact)
  from a healthy devnet with the pinned roots installed. `not_run` is not a pass.
- A guard, race or conformance claim needs the matching ledger and gate. An `owed` or
  `partial` row is a first-class result; a `proved` claim without the theorem and evidence is
  not.
- An audit claim needs `spec/audit/findings.yaml`, its close-out row and the red-team result.
  Never call the internal review an audit or an independent sign-off.
