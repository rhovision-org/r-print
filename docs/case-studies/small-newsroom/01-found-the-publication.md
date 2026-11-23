# Found the publication

> **Status:** Implemented. The publication and membership suites exercise this chapter.

Ada creates the publication with one publisher key. She is the only admin at founding; the
charter allows her to add Bram as editor immediately and to grow the admin set later.

## The charter

Ada commits hashes, not raw copy:

```text
nameHash        hash of "The Ledger"
mastheadHash    hash of the wordmark file
treasuryAccountId  Ada's r-cash business account
assetId         REV
admins          [Ada's public key]
threshold       1
arbitrators     []          # falls back to the platform quorum
revenueSplit    []          # no reader revenue yet
governance      maxMembers 32, fact-check off, K-Asset off
```

`Terms("charter")` checks the admin set, the threshold, the optional arbitrator set, the
split sum and the presence of at least one publisher in the member list.

## The members

| Member | Role | Why |
|---|---|---|
| Ada | `publisher` | Owns the masthead and roster |
| Bram | `editor` | Accepts commissions and releases milestones |
| Dee | `factchecker` | Reviews the article before publication |

Cora is not on the roster yet. She pitches as an external writer; Bram adds her as a
`contributor` when the commission is funded. The commission factory allows a writer who is
not a member, because the point is to commission work from outside the core team.

## The calls

```text
PublicationFactory("create", dId, "create:ledger", "pub:ledger", charter, members)
Publication("addMember", dId, "add-bram", BramRev, "editor", "did:byoid:bram", "att:bram")
Publication("addMember", dId, "add-dee", DeeRev, "factchecker", "did:byoid:dee", "att:dee")
```

Each call consumes `publicationState`, checks Ada's derived address and `publisher` role,
writes once and replies. A repeated `opId` returns the stored reply.

## Solo mode

Ada is 1-of-1. She can release milestones, pause the publication and change the roster. She
cannot arbitrate a disputed commission against a funder by herself: `Publication("arbitration")`
returns the platform `PrintAdmin` quorum when the publication has no independent admin
quorum. That is the price of starting alone, and it is visible in the charter.
