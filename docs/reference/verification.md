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
| `make spec-check` | build, measure, architecture, captures, `select`, placeholders, money, suites, graph |
| `make parse-check` | every built and rendered term parses with the target node parser |
| `make docs-check` | SUMMARY coverage, links, orphans, component coverage, install keys, mdBook build |
| `make client-check` | Rust fmt/clippy/tests, wasm32 check, wasm-pack web build, WASM smoke, web typecheck/test/build |
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
- No audit, no penetration test, no formal refinement.
- No r-sure or r-gen root enabled in the recorded campaign; the adapters were disabled and
  the optional surfaces were exercised with mock entity contracts.
- No multi-validator finality campaign.
- The live browser journey covers a representative path, not all 32 writes; the remaining
  writes have fake-transport unit coverage and fixture browser rendering.
- The live browser journey does not fund a commission (that needs an r-cash-funded account);
  the escrow is covered by the 18-suite campaign and the fake-transport client tests.
- r-sure and r-gen roots remain disabled; cover and K-Asset links are URI surfaces only.

## How to reproduce

```sh
make venv
make spec-check
make parse-check
make docs-check
make client-check
make devnet-up rcash-keys rcash-bootstrap keys install
make unit-all
make client-live
make cli-live
make web-e2e-install
make web-e2e-fixture
make web-e2e-live NODE=http://127.0.0.1:40403
```

A suite that cannot reach a healthy devnet reports `not_run`, never a pass. Report the actual
node build if it differs from `8fe0136`; the live smoke recorded `5b9685e`.
