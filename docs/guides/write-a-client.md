# Write a client

> **Status:** Implemented. `rprint-wallet` owns keys and signing; `rprint-sdk::build_term`
> owns term construction; the CLI and WASM are live clients. The browser is a live client in
> opt-in live mode.

## The stack

| Crate | Role |
|---|---|
| `rprint-core` | Pure types, role/status enums, charter/milestone validation, canonical payloads |
| `rprint-keystore` | Web3 Secret Storage v3 encryption/decryption |
| `rprint-sdk` | JSON → Rholang literals, call terms, explore terms, every write builder and `build_term` |
| `rprint-wallet` | Key generation/unlock, deploy signing, admin/edition payload signing, reply decode |
| `rprint-cli` | `rprint` binary: dry-run terms, live `read`/`submit`, wallet helpers |
| `rprint-wasm` | Browser facade: the same wallet and `build_term`, plus `decode_reply` |

The client does not sign by hand and does not invent a second signer. It reuses r-cash's
`KeyPair`, `DeployOptions`, `SignedDeploy`, `RhoValue` and `Reply`. The deployed `Codec` is
the source of truth for admin payload text.

## Two term shapes

Reads must use explore-deploy:

```text
new return, rl(`rho:registry:lookup`), capCh, resCh in {
  rl!(`uri`, *capCh) |
  for (cap <- capCh) { cap!("info", *resCh) | for (@r <- resCh) { return!(r) } }
}
```

The node returns the value sent on the term's **first private name**. A term built with the
write shape sends on `deployId`; explore-deploy does not capture that, so it returns nothing.

Writes use the signed-deploy shape and send the reply to `deployId`.

## Read and write path

1. Build the term with `rprint-sdk` (`build_term` from JSON, or the typed builder).
2. Reads: `POST /api/v1/explore-deploy`, then decode the first `expr` value.
3. Writes: sign with `rprint-wallet`, `POST /api/v1/deploy`, poll the deploy status, wait for
   `/api/is-finalized/{blockHash}`, then decode `deployResult[0]`.
4. Success is finalized + processedWithSuccess + `(true, …)`. A `(false, reason)` reply is a
   refusal, not an error.
5. A processed deploy that never finalizes is an error. Never retry it with a new op id.

## Keystore

`rprint-keystore` encrypts a 32-byte secret into a Web3 v3 document (scrypt, AES-128-CTR,
Keccak MAC). `rprint-wallet::Wallet::create` generates and encrypts; `unlock` decrypts into
the wallet; `export` re-encrypts. The wasm facade returns the encrypted document and wallet
metadata, never the plaintext secret. `keystore_decrypt` no longer exists.

## CLI examples

```sh
# dry-run term
rprint publication add-member --uri "$PUB" --op add-1 --member "$ADDR" \
  --role writer --did "byoid:rev:$ADDR" --attestation att

# live read and signed submit
rprint --node http://localhost:50403 read --uri "$PUB" --arm info
rprint --node http://localhost:50403 submit --term - --keystore key.json \
  --password-env RPRINT_PASSWORD < term.rho

# wallet helpers
rprint wallet create --out key.json --password-env RPRINT_PASSWORD
rprint wallet sign-payload --keystore key.json --password-env RPRINT_PASSWORD \
  --payload 'rprint:admin:v1|publication:p|3|pause|'
rprint wallet sign-edition --keystore key.json --password-env RPRINT_PASSWORD \
  --manifest @manifest.json
```

## Discovery

There is no indexer. A client uses a curated catalogue, a publication link, or a URI a
reader shared. The publication factory's `issued` arm is a canonical lookup, not an
enumeration API. Do not build a fake search.

## Honest limits

The client is devnet-only and unaudited. Reads are at the node's tip and are not
finality-checked. Writes need a funded native REV vault; commission funding additionally
assumes an r-cash-funded account. Capability-valued `Payments` arms and installer
`PrintRoot`/`PrintAdmin` writes are print-only or operator surfaces, not browser operations.
See [the web surface](../reference/web-surface.md) and
[run the live client](run-live-client.md).
