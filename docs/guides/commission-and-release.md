# Commission and release

> **Status:** Implemented. The commission and commission_dispute suites verify this path.

## 1. The writer proposes

The writer calls `CommissionFactory("propose")` with the canonical publication URI, a brief
hash, a total and milestones. Milestone ids must be unique and amounts must sum to the
total. The writer's derived REV address becomes `writerId`; the writer need not be a
member.

```sh
rprint commission propose \
  --uri <component:commission-factory URI> \
  --op propose:investigation --id investigation:1 --data @commission.json
```

## 2. An editor accepts

An active editor or publisher calls `accept`. The proposal moves to `accepted` and records
the editor. No money has moved.

```sh
rprint commission accept --uri <proposal URI> --op accept:investigation
```

## 3. A funder funds

The funder calls `fund`. The escrow factory withdraws the total from the funder's r-cash
account into a purse held by the escrow. The proposal moves to `funded` and returns the
escrow URI.

```sh
rprint commission fund --uri <proposal URI> --op fund:investigation
```

## 4. The writer submits evidence

The writer calls `submit` for one milestone, before the deadline plus grace, with an
evidence hash. The milestone becomes `submitted`.

```sh
rprint commission submit --uri <escrow URI> --op submit:m1 \
  --milestone m1 --evidence <evidence hash>
```

## 5. An editor releases

An active editor or publisher calls `release`. Every prior milestone must already be
released. The escrow pays the writer and marks the milestone `released`; when every
milestone is released the status is `completed`.

```sh
rprint commission release --uri <escrow URI> --op release:m1 --milestone m1
```

## Failure and cover

- `cancel` before the first release refunds the remainder to the funder.
- `expire` after the hard deadline is permissionless and refunds the remainder.
- `dispute` freezes the escrow; `arbitrate` splits the remainder by `writerBps` with the
  adaptive quorum; `resolveDispute` after the window refunds the remainder.
- `attachCover` verifies and records an r-sure Policy URI. It does not change escrow
  semantics; it is the scaling surface for a publication that wants insurance.

See [commission escrow](../concepts/commission-escrow.md) for the state and refusal shapes.
