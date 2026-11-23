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

## Client flow

The web client's `MultisigPanel` and `LiveExtras` fetch the payload from the deployed
`Codec`. Each signer then unlocks one saved keystore in a temporary WASM wallet, signs the
exact payload text (`sign_text_payload`: BLAKE2b-256 over UTF-8, DER secp256k1), and the
temporary wallet is dropped. The form shows the collected count against the effective
threshold and submits the signatures with the nonce. The contract counts distinct keys; a
below-threshold submit is a refusal.

The CLI equivalent is:

```sh
rprint --node "$NODE" read --uri "$CODEC" --arm adminPayload \
  --args "\"publication:$PUB\", 4, \"pause\", []"
rprint wallet sign-payload --keystore signer.json --password-env PW --payload "$PAYLOAD"
```

Publication admin uses the publication admin set. Arbitration uses the effective authority
from `Publication("arbitration")`, including the platform fallback.

## Rules

- Admin sets require distinct keys; a duplicate is `duplicate key`.
- A threshold below 1 or above the key count is `threshold`.
- A stale nonce is `replay`; a missing signature is `below threshold`.
- A publication admin change does not retroactively change a child contract's admin
  snapshot; rotate active children explicitly.
