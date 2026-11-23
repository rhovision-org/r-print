# Run the live client

> **Status:** Implemented. Devnet-only. The recorded smoke is in
> [verification](../reference/verification.md).

Live mode turns the reference client into a real client. It is off by default; fixture mode
keeps the book and CI usable with no node.

## Prerequisites

- Rust 1.95, the `wasm32-unknown-unknown` target and `wasm-pack`
- Node 22 and `npm`
- Docker, plus the `r-cash` and `rchain-rust` checkouts used by the devnet
- A running local devnet with r-print installed

```sh
make venv
make devnet-up rcash-keys rcash-bootstrap keys install
```

The install writes `deployments/devnet.json`. Its `root_uri` is the directory the client uses
to resolve factories and the codec.

## Build and start

```sh
make client-wasm-pack                 # web/public/wasm
npm --prefix web ci
npm --prefix web run dev              # http://localhost:5173
```

Open Network settings and choose **Live**. Set the node URL (the devnet default is
`http://localhost:40403`; a local campaign may use `50403`), the shard (`/root`), and the root
URI. You can paste `deployments/devnet.json` and press **Use root_uri**. Save.

The status banner should say "Live mode" and show the wallet as locked.

## Wallet and funding

1. Open **Keystore**.
2. Create a wallet or import an existing encrypted v3 document. The document is stored
   locally; the key stays in WASM.
3. Unlock it for the session. Copy the REV address.
4. On **Network**, press **Request 30 REV** (devnet faucet). This funds the native REV vault
   used for phlo.
5. Wait a block or two before the first write.

Commission funding is different: the escrow pulls from the funder's **r-cash account**, not
the native vault. Fund that account with the r-cash tooling or the harness before pressing
**Fund proposal**.

## Write

The forms are on the screens that own the entity:

- Home: found a publication, propose a commission, register an article.
- Publication: pause/resume and the admin multisig.
- Member editor: add/remove/set role/attest self.
- Commission: accept, fund, cancel, attach an r-sure cover.
- Escrow: submit/release milestones, cancel, dispute, arbitrate, resolve, expire.
- Article: submit, attach r-gen knowledge, attest, approve, publish, correct, retract.
- Edition: create, append, seal.

Every form generates an operation id you can edit. Writes are shown in **Deploy** with the
deploy id, block, status and reply. A form is complete only when the deploy is **finalized**
and the reply is `(true, …)`. A refusal is a successful deploy carrying `(false, reason)`.

## Multisig

Publication admin actions and arbitration need more than one key when the threshold is above
one:

1. Save each signer's encrypted keystore on the Keystore page.
2. Prepare the payload in the form. It is fetched from the deployed `Codec`, not built by
   hand in TypeScript.
3. Choose a keystore, enter its password, and sign. The temporary WASM wallet is dropped
   immediately. Repeat for each signer.
4. Submit once the count reaches the displayed threshold. The contract remains the authority;
   a below-threshold submit is a refusal.

## CLI alternative

```sh
rprint --node http://localhost:50403 read --uri "$PUB" --arm info
rprint --node http://localhost:50403 submit --term - --keystore key.json \
  --password-env RPRINT_PASSWORD < term.rho
rprint wallet sign-payload --keystore key.json --password-env RPRINT_PASSWORD \
  --payload "$PAYLOAD"
```

`make client-live` and `make cli-live` run the recorded smoke paths against a devnet.

## Browser end-to-end

```sh
make web-e2e-install                         # one-time Chromium download
make web-e2e-fixture                         # no node, no WASM
make web-e2e-live NODE=http://127.0.0.1:40403
```

The fixture suite is the push/PR gate. The live suite creates two keystores, funds the
publisher from the faucet, founds a 2-of-2 publication, runs an article and edition through
their lifecycles, pauses through the admin multisig, and asserts a `paused` refusal. It
writes `deployments/browser-e2e-results.json`; the CI devnet job uploads it with the
Playwright report. The suite runs against a production build served by `vite preview`, not
the dev server.

## Troubleshooting

- **Live mode says the wasm build is missing.** Run `make client-wasm-pack` and reload.
- **"root not configured".** Set the root URI in Network settings.
- **Insufficient phlo.** Use the faucet and wait a block; the deployer vault must hold REV.
- **CORS or mixed content.** The devnet public API is permissive, but an HTTPS page cannot
  call an HTTP node. Use the local Vite dev server and a local devnet.
- **A write timed out after submission.** Do not create a new operation id. Use the deploy id
  in the Deploy history to recheck; resubmit the same signed body only if you are certain the
  first had no effect.
- **Commission funding refused.** The escrow needs the funder's r-cash account, not only the
  native vault.
