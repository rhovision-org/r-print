# Why primitives

> **Status:** Orientation. This chapter explains the design choice; it is not a claim that
> every fork should stop at the same scope.

A platform would be easier to demo and harder to trust. r-print is a set of primitives
because a publication must be able to leave. The contracts are small enough to audit one
cell at a time, and the interfaces are explicit enough that another client, another
publication or another chain can read the same facts.

Four choices follow from that.

**One cell per object.** A publication, a commission, an escrow, an article and an edition
each have one state cell and one writer. There is no global counter and no shared mutable
cache. A refusal reposts the cell unchanged; a successful mutation reposts exactly once.
This makes the concurrency story inspectable.

**Hashes, not content.** Content stays off-chain. The chain stores content hashes, byline
hashes, evidence hashes and URIs. r-print does not host an article, run an indexer or
promise data availability. A publication's own archive is the availability layer.

**Named edges, not a monolith.** Escrow is an r-print primitive, but proper insurance is
r-sure's job and knowledge assets are r-gen's job. The integration graph names every edge:
`funds`, `escrows`, `releasesMilestone`, `covers`, `validatesClaim`, `mintsKAsset`,
`provenanceOf`, `wraps`, `publishedIn`, `annotates`, and so on. A r-print contract reads a
sibling fact by `rho:id:` URI; the sibling never calls back. This keeps r-print an extension,
not a new core.

**Honest gates.** `make spec-check` checks build drift, budgets, captures, `select`, integer
money, suite mapping and the graph. `make parse-check` runs the target node's parser.
`make unit-all` records pass, fail or not-run. A suite that cannot reach a devnet is
`not_run`, never a pass.

The cost of primitives is assembly. A fork must choose a treasury policy, a content
availability layer, a reader identity story and its own legal posture. That is the point:
those are the publication's decisions, not a platform's.
