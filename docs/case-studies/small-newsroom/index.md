# A small newsroom

> **Status:** Implemented path. The behavior suite runs this sequence end to end; the
> component suites cover the refusal and dispute branches.

This walkthrough follows three people starting a publication:

- **Ada** is the publisher. She holds the masthead key.
- **Bram** is the editor. He accepts pitches and releases milestones.
- **Cora** is a freelance writer. She is not on the roster when she pitches; she is added as
  a contributor when the commission is funded.

They have no backend, no indexer and no hosted wallet. They use the CLI and a shared
archive for the copy. The chain holds the organisation, the escrow, the article record and
the edition manifest.

## The shape

```
Publication (Ada, 1-of-1 publisher)
  └── Commission (Cora, two milestones, funded by Ada)
        └── Escrow (stipend 400, final 600)
  └── Article (Cora, content hash, review, corrections)
        └── Edition 1 (Bram seals the ordered manifest)
```

The three chapters follow the sequence:

1. [Found the publication](01-found-the-publication.md) — charter, roster, solo mode.
2. [Commission an investigation](02-commission-an-investigation.md) — proposal, accept,
   fund, submit, release.
3. [Publish and correct](03-publish-and-correct.md) — article, review, edition, correction.

The baseline escrow is the rail in this walkthrough. The newsroom does not attach an r-sure
policy yet; Ada notes the option in the charter review for the next investigation, when the
sums justify underwriting. Cora does not link a K-Asset; the content hash is enough for the
first story. Both surfaces are named and available without changing this path.
