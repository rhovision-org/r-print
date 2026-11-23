# Test your fork

> **Status:** Implemented. The suite registry and the static gates are the test contract.

## The layers

| Layer | Command | What it proves |
|---|---|---|
| Build | `make build-check` | Inlined terms are up to date |
| Budgets | `make measure-check` | Each term is under the 56 KiB hard budget |
| Architecture | `make check-arch` | Components, state cells and dependencies are valid |
| Captures/select | `make check-captures`, `make check-select` | No forbidden capability capture, no `select` |
| Money | `make check-money` | Integer money only |
| Suites | `make check-suites` | Every harness suite is mapped |
| Graph | `make check-graph` | Every vertex and edge is named and sourced |
| Parser | `make parse-check` | The target node parses every rendered term |
| Behaviour | `make unit-all` | The devnet campaign |
| Browser fixture | `make web-e2e-fixture` | Every route and write form in Chromium with no node or WASM |
| Browser live | `make web-e2e-live` | The real browser → WASM → node journey on a devnet |

## Add a suite

1. Write `harness/unit_<name>.py`. It must print a header and return `0` on pass, `1` on
   fail, `2` on not-run. Use `preflight.require_devnet` and return 2 when the devnet is
   unhealthy.
2. Register it in `harness/run_suites.py` `SUITES`.
3. Add a Makefile `unit-<name>` target only if the README or docs refer to it; the runner is
   authoritative.
4. Add refusal and idempotency cases. A success-only suite is not enough.
5. If the suite moves value, add it to the conservation set.
6. Update the acceptance map in `spec/acceptance.yaml` and the verification chapter.

## Golden transcripts

`harness/unit_behavior.py` runs the small-newsroom path and compares a transcript to
`harness/scenarios/golden/newsroom.json`. Update the golden only when the behaviour
intentionally changes, and say so in the commit.

## Devnet caveat

The recorded campaign used rholo node `0.1.0` build `8fe0136` on the local 50403 devnet.
The r-cash components were installed from the pinned commit. If your node or r-cash differs,
a suite may fail for an environmental reason; record the actual node and do not turn a
not-run into a pass.

## Fork checklist

- Keep the canonical publication binding (`PublicationFactory("issued")`).
- Keep the cell doctrine and the no-`select` rule.
- Keep the refusal vocabulary or update every suite and the reference page.
- Keep the optional surfaces optional. Do not make a K-Asset or an r-sure policy mandatory
  by default.
