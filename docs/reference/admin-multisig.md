# Admin multisig

> **Status:** Implemented. The admin and admin_keys suites pass.

## Platform admin

`PrintAdmin` is installed with 2-of-3 keys. `AdminGuard("verify", domain, nonce, action,
args, sigs, admins, threshold)` computes the canonical payload and counts distinct
secp256k1 signatures. A platform admin set requires at least two distinct keys and a
threshold of at least two.

The payload is:

```
rprint:admin:v1|<domain>|<nonce>|<action>|<arg0>,<arg1>,…
```

The digest is blake2b-256 over the UTF-8 payload; signatures are DER secp256k1 over the
digest. The nonce is monotone; a nonce at or below the stored nonce is `replay`.

## Publication admin

A publication may be 1-of-1 solo mode. `pubVerifyAdmin` uses the same payload prefix but
allows 1–5 distinct keys and a threshold from 1 to the key count. A publication admin
action covers `pause`, `resume`, `setAdmins`, `setThreshold` and `setTreasury`. The nonce is
per publication.

## Arbitration

`Publication("arbitration")` returns the effective authority:

1. the publication's `arbitrators` set, if non-empty (2–5 keys, threshold at least 2);
2. else its admins, if at least two distinct keys;
3. else the platform `PrintAdmin` keys and threshold.

The escrow's `arbitrate` arm uses that authority over the domain
`commission:<escrowId>`, action `split`, args `[escrowId, writerBps]`. A solo publisher
therefore cannot unilaterally arbitrate against a funder.

## Building a payload

Use `Codec("adminPayload", domain, nonce, action, args)` on-chain or the client's canonical
builder. Do not join the public keys with a comma in TypeScript and hope it matches; the
deployed codec is the source of truth.

## Rules

- Admin sets require distinct keys; a duplicate is `duplicate key`.
- A threshold below 1 or above the key count is `threshold`.
- A stale nonce is `replay`; a missing signature is `below threshold`.
- A publication admin change does not retroactively change a child contract's admin
  snapshot; rotate active children explicitly.
