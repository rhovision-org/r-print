# Create a publication

> **Status:** Implemented. The publication and membership suites verify this path.

## Prepare the JSON

A charter has committed hashes, not raw copy. A minimal solo charter:

```json
{
  "nameHash": "name:the-ledger",
  "mastheadHash": "mast:the-ledger",
  "taglineHash": "tag:local",
  "treasuryAccountId": "<your r-cash account id>",
  "assetId": "REV",
  "admins": [{"$bytes": "<your compressed public key hex>"}],
  "threshold": 1,
  "arbitrators": [],
  "arbitrationThreshold": 0,
  "revenueSplit": [],
  "governance": {
    "maxMembers": 32,
    "requireFactCheck": false,
    "disputeWindowBlocks": 10,
    "commissionGraceBlocks": 10
  }
}
```

The member list is keyed by derived REV addresses:

```json
[
  {"memberId": "<publisher REV address>", "role": "publisher",
   "did": "did:byoid:publisher", "attestationHash": "att:publisher"},
  {"memberId": "<editor REV address>", "role": "editor",
   "did": "did:byoid:editor", "attestationHash": "att:editor"}
]
```

## Build the term

```sh
rprint publication create \
  --uri <component:publication-factory URI> \
  --op create:the-ledger --id pub:the-ledger \
  --charter @charter.json --members @members.json
```

The CLI prints the canonical Rholang call term. Sign and submit it with the r-cash
signed-deploy client, or use the harness fixtures if you are on a devnet.

## What the factory checks

- the creator is a member with role `publisher`;
- the publication id is non-empty and at most 64 bytes;
- the charter hashes are present, the asset is REV, the admin set is 1–5 keys with a valid
  threshold, the optional arbitrators are 2–5 with threshold at least 2, and the split sums
  to 10000 bps or is empty;
- the member list has at least one publisher and no duplicate member id.

The factory then spawns the publication cell and records the canonical id → URI binding.

## After creation

Add editors and factcheckers with `Publication("addMember")`. Keep the publisher key safe:
a solo publisher can change the roster and pause the publication. If you want an
independent arbitration quorum, add at least one more admin key or an `arbitrators` set.
