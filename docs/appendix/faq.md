# FAQ

> **Status:** Reference.

**Is an article stored on-chain?** No. The chain stores a content hash, bylines, reviews,
corrections and manifest hashes. The publication's archive stores the copy.

**Do I need an r-gen KAsset to publish?** No. `attachKnowledge` is optional. A publication
can set `requireKAsset` on an article or a policy, but the default path uses a content hash
alone.

**Do I need an r-sure policy to commission work?** No. Escrow is the baseline. `attachCover`
records a policy reference when a publication wants insurance at scale.

**Who can release a milestone?** An active editor or publisher. The writer submits evidence;
the editor releases. The escrow enforces the order and pays at most once.

**What happens if a solo publisher disputes a commission?** Their effective arbitration
authority is the platform `PrintAdmin` quorum, or the publication's arbitrators if set. A
solo publisher cannot unilaterally arbitrate against a funder.

**Can a writer be outside the roster?** Yes for a commission: the writer need not be a
member. For an article, the authors must be active members with a writing role, so a
publication adds an external writer as a `contributor` when the piece is commissioned.

**What is a member id?** The REV address derived from the member's deployer key. It is not a
caller-supplied string.

**Are corrections editable?** No. They append and reference the published content hash. A
retraction appends a retraction record and sets the status.

**Can an edition be changed after sealing?** No. A sealed edition is immutable; a later
retraction is recorded on the article.

**Is this audited?** No. It is devnet-only and unaudited. The 18/18 suite campaign is a local
test result, not an audit.

**Where is the web client?** It is a live client in opt-in live mode: fixture mode is the
default for tests and the book, and live mode signs real deploys against a devnet with the
key held in WASM. See [Run the live client](../guides/run-live-client.md).
The Rust SDK/CLI/WASM are the working client surface.

**Why are there two adapters?** r-gen supplies knowledge assets and credentials; r-sure
supplies insurance. They are separate siblings with separate roots. r-print reads them by
URI and never calls back.

**What is the integration graph?** `spec/graph/vertices.yaml` and `edges.yaml` name every
vertex and edge. `make check-graph` validates them. The book chapter is
[integration graph](../reference/integration-graph.md).
