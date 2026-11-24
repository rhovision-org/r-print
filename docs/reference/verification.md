# Verification

> **Status:** The measured v0.1 campaign. This is a local devnet result, not an audit.

## The recorded campaign

On the local 50403 devnet, the full **19/19** behavioural suites passed in one run:

```
admin, admin_keys, article, article_refusals, behavior, commission,
commission_dispute, commission_refusals, conservation, coordination, corrections,
edition, interfaces, membership_auth, pause_scope, payments, publication, root, schema
```

The node reported `rholo node 0.1.0` build `8fe0136`. The r-cash components were installed
from the pinned commit `49b441dea4f5561992387ed670ab263fcd5dd164`. The suite results are
written to `deployments/suite-results.json` and are gitignored. A fresh local 40403 devnet
on node build `5b9685e` independently passed 18/18 after the suite key fix.

## Recorded live client smoke

On 2026-11-23 the live client smoke ran against the local 50403 devnet with rholo node build
`5b9685eca38250a9f0d81fb3da2f410328721aec`. It used the real WASM wallet and term builders,
the real HTTP transport and the real finality wait:

| Step | Result |
|---|---|
| create wallet and faucet | pass |
| create a publication with a 2-of-2 admin set | finalized |
| add a writer | finalized |
| propose a commission | finalized |
| create, submit, approve, publish an article | finalized |
| create an edition, append the article, sign and seal | finalized |
| read publication, article and edition back | pass |
| fetch the Codec payload, sign with two keystores, pause via admin multisig | finalized |

Eleven deploys, all `finalized`; the machine-readable record is
`deployments/live-client-results.json`. `make cli-live` separately records a CLI
create-and-read against the same devnet. These are local results, not a public testnet run.

## Browser end-to-end campaign

The Playwright layer runs the reference app in a real Chromium browser:

| Suite | Result |
|---|---|
| Fixture, `fixture-chromium` + `fixture-mobile` | **27 tests**, all 12 routes, all 32 write methods (33 form instances), settings, catalogue, keystore, deploy history and a mobile smoke |
| Live, `live-chromium` | **13 steps**, **10 finalized** writes and **1 refused** deploy |

The fixture suite runs with no node and no generated WASM: it aborts `**/api/**` and
`**/wasm/**` and fails if either is requested. The live suite switches the app from fixture
to live in the browser, creates two keystores, funds the publisher from the devnet faucet,
founds a 2-of-2 publication, adds a writer, runs an article through create → submit →
approve → publish, creates and seals an edition, pauses through the admin multisig, then
submits an article against the paused publication and asserts the `paused` refusal. It
reloads and reads the publication, article, edition, deploy history and keystores back.

The recorded local run used rholo node build `5b9685e` on the local 40403 devnet. The result
is `deployments/browser-e2e-results.json`. The fixture suite is a push/PR CI gate; the live
suite runs in the dispatch/schedule devnet job.

The dispatch run
[45270193372](https://github.com/rhovision-org/r-print/actions/runs/45270193372) passed
every job. The `web` job recorded the **27** fixture tests. On the pinned node
`RChain Node 0.1.0` build `e2d073dcd02f1e560ccb84749937138a1e184b0b`, the `devnet` job
recorded **18/18** suites, **11/11** live-client steps and a **13-step** browser journey with
**10 finalized** writes and **1 refusal**. The artifacts are `playwright-fixture`,
`browser-e2e` and `suite-results`.

## Formal model

`make formal-check` builds the Lean 4.12 project, runs the axiom audit, compares the emitted
vectors with `spec/vectors/lean.json`, and checks the flow manifest in strict mode. The
measured result is:

| Check | Result |
|---|---|
| Lean build and axiom audit | **239 source theorems**, 239 axiom audits |
| Proof escapes | 0 `sorry`/`admit`/`axiom`/`native_decide`; only `propext`, `Classical.choice`, `Quot.sound` |
| Vectors | **90** deterministic vectors in `spec/vectors/lean.json` |
| Conformance corpus | **20** rows in `spec/vectors/core.tsv`, emitted by `RPrint/EmitCorpus.lean` |
| Flow manifest | **46 rules**, **16 core arms** `proved-conformance`, **20** `proved-conformance` rules, **14** `proved-model` rules, 0 proof-quality warnings |

The model covers publication authority and membership, commission proposal and escrow,
article lifecycle, edition seal, coordination records, and the r-sure cover and r-gen
knowledge ties, plus the shared linear-cell and protocol layer. It is `proved-model`: theorems about the shallow Lean state
machines, not a refinement of the deployed Rholang. ERTP purse atomicity, phlo, cryptography,
node scheduling, deploy atomicity and the cross-contract ties are explicit boundary assumptions
in `spec/lean/RPrint/Model/System.lean`.

## Rigor ledger, guard bridge, race matrix and conformance

The M13 model tranche adds four evidence layers around the state machines:

| Layer | Measured result |
|---|---|
| Rigor ledger (`spec/proofs/rigor.yaml`) | **26** invariant rows, **30** claims, **25** boundary assumptions, **10** model/code divergences, **10** roadmap items |
| Guard bridge (`ArmGuards.lean`, `spec/guards/arms.yaml`) | **33** mutating cornerstone arms: **33** `proved`, **0** `partial`, **0** `owed` |
| Race matrix (`spec/flows/races.yaml`) | **29** arm pairs over six cells; **29** proved, **0** `owed` |
| Conformance bundle (`EmitCorpus.lean`, `spec/vectors/core.tsv`) | **20** `proved-conformance` arms, **20** emitted rows |
| Client-op map (`spec/vectors/client-ops.tsv`) | **45** methods (**34** writes, **11** reads): **29** recorded, **5** fixture-only, **11** no live test |

The guard bridge is a drift check, not a semantics-preserving extraction. The race matrix is
pair-level, not scheduler-level race freedom. `proved-conformance` is a finite bundle of a
theorem, a Lean-emitted vector row and a suite assertion; it is not a refinement of the
deployed Rholang.

## Internal adversarial audit

The audit is an internal maintainer review, not an independent audit. The records are
`spec/audit/findings.yaml` (**10** findings), `spec/audit/closeout.yaml` (**6** terminal
decisions), `spec/audit/improvement-plan.yaml` (**7** items), `spec/audit/redteam.yaml`
(**12** probes: **11** `fixed`, **1** `accepted`), `spec/hazop/worksheet.yaml` (**8** nodes,
**32** rows, **30** negative) and `spec/audit/capabilities.yaml` (**28** rows over **21**
published bundles, **3** capability findings).

The fake-policy and fake-chain probes (RT-007, RT-011) now refuse at the membership check.
The remaining accepted probe (RT-012) attaches a real Claim and KAsset with a self-consistent
fake provenance, because the pinned r-gen rev has no provenance membership query. That is the
RPA-001 residual; it is risk-accepted until M14 and expires on 2027-02-28. Independent review
remains outstanding (RPA-009).

## Sibling surfaces — recorded local campaign

On 2026-11-24 a fresh local 40403 devnet (rholo node build `5b9685e`) installed the pinned
r-sure `0da5d04` and r-gen `bcc840c` roots, then recorded:

| Check | Result |
|---|---|
| Safe behavioural suites | **19/19**, 259 assertions |
| `cover` real-sibling suite | **pass**, 17 assertions against a real r-sure Policy |
| `knowledge` real-sibling suite | **pass**, 26 assertions against a real r-gen Claim → KAsset → Provenance chain |
| CLI live | **2/2**, including the cover + knowledge journey |
| Web live smoke | **12 steps**, cover attached; knowledge `not_covered` |

The campaign found three real integration defects that the mock-only suites missed: r-gen
state URIs are Rholang `Uri` values and must be normalized with `.toString()` before
comparison; r-gen's root `resolve` is `(key, ret)` while r-sure's is
`(key, minVersion, ret)`; and the credential lifecycle is read from `Credential("get")`, not
the factory's issue record. All three are fixed and covered by `unit_knowledge`. The local
records are `deployments/sibling-suite-results.json`, `deployments/sibling-fixture.json` and
`deployments/cli-live-results.json`. The CI dispatch for this campaign is pending because the
M12 commits are not pushed.

The `cli-live` sibling test creates a publication with the policy-insured treasury, attaches
the real cover, attaches the real knowledge chain and asserts the overwrite refusal. The web
live smoke attaches the cover only: its fresh WASM wallet cannot sign the r-gen claimant, and
the WASM facade has no raw-secret import. That omission is recorded in
`deployments/live-client-results.json`.

The roots remain disabled by default; enabling them is the explicit
`make install-with-siblings` opt-in.

## CI devnet campaign

The dispatch run
[45250733118](https://github.com/rhovision-org/r-print/actions/runs/45250733118) passed
every job, including the `devnet` job. On the pinned node `RChain Node 0.1.0` build
`e2d073dcd02f1e560ccb84749937138a1e184b0b`, the campaign recorded:

- **18/18** behavioural suites pass on the GitHub Actions Docker devnet (public 40403).
- The live client smoke passed 11 steps with 11 finalized deploys (wallet, publication,
  member, commission proposal, article lifecycle, edition seal, admin multisig).
- The job uploaded `suite-results.json` and `live-client-results.json` as the
  `suite-results` artifact.

Push and pull-request runs keep static/docs/parse/client/web as gates; the devnet job runs
on dispatch and schedule because it builds the node image and a Docker network. The browser
tranche dispatch run 45270193372 passed the same gates plus the fixture suite in the `web`
job and the live browser journey in the `devnet` job; see the browser section above for its
counts.

## Static and parser gates

| Gate | Result |
|---|---|
| `make spec-check` | build, measure, architecture, captures, `select`, placeholders, money, suites, graph, guard bridge, race matrix, rigor, conformance, client map, capabilities, audit, close-out, HAZOP |
| `make check-rigor` | 26 coverage rows, 30 claims, 25 assumptions, 10 divergences |
| `make check-guard-bridge` | 33 mutating arms: 33 proved, 0 partial, 0 owed |
| `make check-race-matrix` | 29 pairs: 29 proved, 0 owed |
| `make check-conformance` | 20 promoted arms, 20 emitted rows |
| `make check-client-ops` | 45 methods: 29 recorded, 5 fixture-only, 11 no live |
| `make check-capabilities` | 31 capability rows, 24 published bundles, 3 findings |
| `make check-schemas` | 7 state schemas, 7 examples, doc and source field sets agree |
| `make check-arm-inventory` | 124 deployed arms: 33 guard, 46 flow, 78 inventory |
| `make check-audit check-closeout check-hazop` | 10 findings, 6 close-out rows, 47 HAZOP rows |
| `make parse-check` | every built and rendered term parses with the target node parser |
| `make docs-check` | SUMMARY coverage, links, orphans, component coverage, install keys, mdBook build (57 chapters) |
| `make formal-check` | Lean build, axiom audit, vector corpora, strict flow traceability |
| `make client-check` | Rust fmt/clippy/tests, wasm32 check, wasm-pack web build, WASM smoke, web typecheck/test/build |
| `make check-graph` | 25 vertices, 36 edges (20 implemented, 10 surface, 6 design) |

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
- **coordination**: publication-bound create, active-member signer set, ordered
  address-bound signatures, the golden recorded outcome, identical replay, different-outcome
  refusal, bad-signature/wrong-order/non-member refusals, duplicate id, writer-only create and
  paused-publication create; the publication state is byte-identical before and after a record.
- **interfaces / pause_scope**: adapters disabled by default, mock Claim/KAsset/Provenance
  reads including `provenanceInfo`, publication pause blocking new work while existing escrow
  releases continue.
- **cover / knowledge (sibling group)**: real r-sure policy and real r-gen chain, every strict
  refusal branch, replay and overwrite, and the escrowed cover carrying through funding.
- **live client**: the Node script exercises the real WASM term/sign/poll path; the vitest
  suite covers every `RprintApi` write through a fake bridge and transport, including
  refusals, processed-with-error and finality timeouts.
- **browser fixture**: every route and every write form render in Chromium with a fresh
  context, no node and no WASM; the request blocker proves the isolation.
- **browser live**: the real browser, Vite build, WASM wallet, HTTP transport and finality
  wait execute the publication, article, edition, multisig and refusal journey.

## What is not verified

- No public testnet or mainnet run; the CI devnet is a local single-validator Docker
  network, not a public network.
- No audit and no penetration test. The Lean model is `proved-model`; there is no refinement
  theorem tying it to the deployed Rholang. The guard bridge is a drift check; the race
  matrix is pair-level, not scheduler-level race freedom.
- The sibling adapters check policy, claim, KAsset and credential membership, but provenance
  membership has no query in the pinned r-gen rev. A real chain with a self-consistent fake
  provenance is accepted; RPA-001 is risk-accepted for that residual until M14, and RT-012 is
  the evidence.
- Eight of the 32 client writes have no live test (membership changes, pause, proposal
  cancel, article attest/correct/retract and browser-only paths among them). The client-op
  map records them; this is not a claim that they are live-tested.
- The strict cover and knowledge chains are recorded locally against real r-sure and r-gen
  roots; the CI dispatch for that campaign is pending because the commits are unpushed. There
  is no independent audit.
- No multi-validator finality campaign.
- The live browser journey covers a representative path, not all 34 writes; the remaining
  writes have fake-transport unit coverage and fixture browser rendering.
- The live browser journey does not fund a commission (that needs an r-cash-funded account);
  the escrow is covered by the 18-suite campaign and the fake-transport client tests.
- The r-sure and r-gen roots remain disabled by default; enabling them is an explicit
  `make install-with-siblings` opt-in.

## How to reproduce

```sh
make venv
make spec-check
make parse-check
make docs-check
make formal-check
make client-check
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
make client-live
make cli-live
make web-e2e-install
make web-e2e-fixture
make web-e2e-live NODE=http://127.0.0.1:40403
# optional sibling surfaces, after installing the pinned roots:
make siblings-venv siblings-install install-with-siblings
make sibling-suites-strict
make client-live RPRINT_SIBLINGS=1
make cli-live RPRINT_SIBLINGS=1
make redteam
make check-redteam-results
```

A suite that cannot reach a healthy devnet reports `not_run`, never a pass. Report the actual
node build if it differs from `8fe0136`; the live smoke recorded `5b9685e`.
