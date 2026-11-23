# r-print

**On-chain newspaper and magazine primitives for rholo, settled through r-cash.**

> **Status:** Devnet-only, unaudited. 18 behavioural suites pass on the local 50403 devnet;
> a recorded live-client smoke on the same devnet founded a publication, wrote an article and
> sealed an edition with 11 finalized deploys; the CI dispatch devnet independently recorded
> 18/18 suites and 11/11 finalized live steps. A Chromium fixture suite covers every route
> and write form with the node and WASM blocked, and a live browser journey records 10
> finalized writes and 1 refusal; CI dispatch 45270193372 recorded 27 fixture tests and the
> browser journey on the pinned node. The baseline escrow is implemented; r-sure cover and r-gen
> K-Assets are optional surfaces. A Lean 4.12 model covers publication authority, commission
> escrow, article lifecycle and edition seal as `proved-model`; it is not a Rholang
> refinement. Subscriptions, revenue splits and crowdfunding remain design.

r-print treats a publication as an organisation rather than a personal brand. A masthead
owns a charter, a roster and an editorial authority. A commission escrows money against
milestones, so a writer can eat and sleep while the work is researched. An article is an
editorial record over a content hash, with an optional Claim → KAsset → Provenance chain for
extra credibility. An edition is an ordered, editor-signed manifest. Corrections append;
they never rewrite history.

The design has three layers:

| Layer | What it is | Status |
|---|---|---|
| Organisation | Publication charter, roster, roles, solo mode, arbitration | Implemented |
| Editorial | Commission escrow, articles, reviews, corrections, editions | Implemented |
| Scaling surfaces | r-sure policy cover; r-gen Claim/KAsset/Provenance links | Surface, opt-in |

Escrow is the baseline because it is the smallest thing that works. Escrow becomes dead
money at scale, so a publication can attach an r-sure Policy to a commission and buy proper
insurance without changing the baseline. K-Assets are optional for the same reason: writers
are used to publishing with a content hash, and a publication can opt into the r-gen chain
when it wants stronger provenance.

## The ladder

| Stage | What it proves |
|---|---|
| A small newsroom | charter, roster, one commission, one article, one correction |
| A magazine | ordered editions and a stable masthead |
| An investigation desk | multi-milestone escrow, expenses, dispute and cover |
| A syndicated publication | licensing and revenue splits (design) |

## What is here

| Path | Contents |
|---|---|
| `contracts/src/deploy/` | 13 numbered deploy terms |
| `harness/` | installer, fixtures, 18 behavioural suites |
| `spec/graph/` | the named integration graph |
| `spec/lean/` | Lean 4.12 model, axiom audit, vectors and flow traceability |
| `crates/` | Rust core, keystore, SDK, wallet, CLI and WASM facade |
| `web/` | React/Vite/TS live client with typed forms for every write; fixture default |
| `web/e2e/` | Playwright fixture and live browser journeys |
| `docs/` | this book |

## Read next

- [The atomisation problem](orientation/the-atomisation-problem.md)
- [A publication as an organisation](concepts/publication-as-organisation.md)
- [Commission escrow](concepts/commission-escrow.md)
- [The integration graph](reference/integration-graph.md)
- [Status, scope and honest limits](orientation/status-and-scope.md)

"Implemented" never means "audited", "battle-tested" or "safe for real value". See the
verification chapter for the measured campaign and the exact devnet caveat.
