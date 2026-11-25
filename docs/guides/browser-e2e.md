# Browser end-to-end

> **Status:** Implemented and recorded on a local devnet. Devnet-only; not a public testnet
> run and not an audit.

The Playwright layer exercises the reference app in a real Chromium browser. It has two
independent suites: a fixture suite that runs on every push and pull request, and a live
suite that runs in the dispatch/schedule devnet job.

## Commands

```sh
make web-e2e-install                         # one-time Chromium download
make web-e2e-fixture                         # fixture projects; no node, no WASM
make web-e2e-live NODE=http://127.0.0.1:40403
```

The live target builds the web WASM package and starts a production Vite build with
`vite preview`; the fixture target does neither. The preview server avoids the development
file watcher, which can hit an open-file limit in a large checkout.

## Projects

`web/playwright.config.ts` defines three projects:

| Project | Test directory | What it proves |
|---|---|---|
| `fixture-chromium` | `e2e/fixture`, `e2e/state` | Every route, every write form, settings, catalogue, keystore, deploy history |
| `fixture-mobile` | `e2e/mobile` | The same fixture app on a Pixel 7 viewport |
| `live-chromium` | `e2e/live` | The real browser → Vite → WASM → HTTP node path |

The fixture suite has 28 tests. `e2e/support/fixture-test.ts` aborts `**/api/**` and
`**/wasm/**` and fails if either is requested, so a fixture pass cannot hide a node or WASM
dependency. The live suite is one serial test with `test.step` phases; it writes
`deployments/browser-e2e-results.json` only on success. The Playwright JSON and HTML reports
are under `web/test-results/` and `web/playwright-report/`.

## The live journey

The live test starts in fixture mode, pastes the deployment manifest to take its `root_uri`,
switches to live in Network settings, then:

1. verifies node status and resolves a component through the root;
2. creates two keystores and unlocks the publisher;
3. faucets the publisher and waits for two blocks;
4. founds a 2-of-2 publication and adds a writer;
5. creates, submits, approves and publishes an article;
6. creates, appends and seals an edition;
7. unlocks the writer, faucets them, and proposes a commission as the writer;
8. unlocks the publisher, deposits native REV into the publisher's r-cash account, accepts
   the proposal, funds the escrow, and reads the escrow back;
9. prepares the Codec payload and pauses through two signatures;
10. submits an article against the paused publication and asserts the `paused` refusal;
11. checks the deploy history for 14 finalized deploys and 1 refusal;
12. reloads and reads the publication, member, article, edition, escrow, keystores and
    settings back.

The recorded 2026-11-25 local run is 18 steps with rholo node build `5b9685e`. The live run
does not attach an r-sure policy or an r-gen K-Asset, and does not submit all 34 writes live;
the remaining writes have fake-transport unit coverage and fixture browser rendering. The
browser artifact lists `publicationAdmin` and `escrowInfo`, which `make check-client-ops`
enforces.

## Determinism

- After the initial document load, navigate by `window.location.hash`. A `page.goto` or
  `page.reload` reinitializes the WASM module and locks the wallet; only the final read-back
  reloads.
- Use state waits (`expect` on a status attribute or reply) and `expect.poll` for node
  height. Never use `page.waitForTimeout`.
- Fresh browser context per test, no stored profile, no seed localStorage. The live run uses
  a unique `runId` in publication, article and edition ids.
- No retries. A retry would hide flake and, live, create duplicate on-chain state; rerun with
  a new `runId`.
- Select one-off forms by `data-testid="form-<method>"`. Select selects by accessible role
  (`getByRole("combobox", { name })`), because an exact label lookup sees the option text
  inside the wrapping label.
- Assert full URIs and addresses from `data-*` attributes; the visible `Hash` text is
  shortened.

## Environment

| Variable | Meaning |
|---|---|
| `RPRINT_E2E_LIVE=1` | Required to run the live test; the Make target sets it |
| `RPRINT_NODE` | Node URL, default `http://localhost:40403` |
| `RPRINT_ROOT` | Optional root URI; otherwise read from `deployments/devnet.json` |
| `RPRINT_REPO` | Repository root for the manifest and result file; the Make target sets it |

If the variable is missing, the live test is skipped, not passed. If it is set and the node,
manifest or WASM is unhealthy, the test fails.

## CI

The `web` job installs Chromium, runs `make web-e2e-fixture` before building WASM, then runs
typecheck, vitest and the production build. It uploads `playwright-fixture` on every run.

The `devnet` job runs the fixture and live suites against the Docker devnet after the 18
suites and the Node/CLI smokes, with `NODE=http://127.0.0.1:40403`. It uploads
`browser-e2e` with both Playwright reports and `deployments/browser-e2e-results.json`.
The live suite is `not_run` when the dispatch/schedule job is not invoked, never a pass.

The recorded dispatch run
[45270193372](https://github.com/rhovision-org/r-print/actions/runs/45270193372) passed
every job: 27 fixture tests in `web`, and on pinned node `e2d073d` 18/18 suites, 11/11
live-client steps and a 13-step browser journey with 10 finalized writes and 1 refusal.

See [verification](../reference/verification.md) for the recorded counts and
[web client spec](web-client-spec.md) for the client contract.
