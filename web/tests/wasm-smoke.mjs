// Offline smoke test for the wasm boundary. No devnet, no network.
//
// Build first:
//   make client-wasm-node
// Then:
//   node web/tests/wasm-smoke.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wasm = require("./wasm-node/rprint_wasm.js");

assert.equal(wasm.version(), "0.1.0");
assert.equal(typeof wasm.build_term, "function");
assert.equal(typeof wasm.decode_reply, "function");
assert.equal(wasm.keystore_decrypt, undefined, "plaintext-secret export must be gone");
assert.equal(wasm.keystore_encrypt, undefined, "secret-injection export must be gone");

const create = wasm.build_term(
  JSON.stringify({
    op: "createPublication",
    factoryUri: "rho:id:fac",
    opId: "op:smoke",
    publicationId: "pub:smoke",
    charter: {},
    members: [],
  }),
);
assert.match(create, /C!\("create"/);
assert.match(create, /deployId!\(r\)/);

const read = wasm.build_term(
  JSON.stringify({ op: "read", uri: "rho:id:pub", binding: "info", args: null }),
);
assert.match(read, /^new return, rl\(/);
assert.doesNotMatch(read, /deployId/);

const deposit = wasm.build_term(
  JSON.stringify({
    op: "rcashDeposit",
    accountFactoryUri: "rho:id:factory",
    amount: 10,
    opId: "deposit:smoke",
  }),
);
assert.match(deposit, /getOrCreate/);
assert.match(deposit, /account!\("deposit", \*deployerId, "REV"/);

const wallet = new wasm.Wallet();
const created = JSON.parse(wallet.create("smoke-password"));
assert.match(created.address, /^1111/);
assert.equal(created.publicKey.length, 130);
assert.ok(created.document.includes("ciphertext"));

wallet.lock();
assert.equal(wallet.is_unlocked(), false);
assert.throws(() => wallet.address());

const unlocked = JSON.parse(wallet.unlock(created.document, "smoke-password"));
assert.equal(unlocked.address, created.address);
assert.equal(unlocked.publicKey, created.publicKey);

const signed = JSON.parse(
  wallet.sign_deploy(
    "Nil",
    JSON.stringify({
      validAfter: 12345,
      phloLimit: 1000000,
      phloPrice: 1,
      shard: "/root",
      timestampMillis: 1700000000000,
    }),
  ),
);
assert.ok(signed.deployId.length >= 140, "deploy id should be a DER signature hex");
assert.equal(signed.body.data.term, "Nil");
assert.equal(signed.body.data.validAfterBlockNumber, 12345);

const payloadSignature = wallet.sign_text_payload("rprint:admin:v1|p|3|pause|");
assert.match(payloadSignature, /^30/);

const edition = JSON.parse(
  wallet.sign_edition_manifest(
    JSON.stringify({
      editionId: "ed",
      publicationId: "pub",
      number: 1,
      titleHash: "title",
      coverHash: "cover",
      articleHashes: ["h1", "h2"],
    }),
  ),
);
assert.equal(edition.manifestHash.length, 64);
assert.match(edition.signature, /^30/);

const ok = JSON.parse(
  wasm.decode_reply(
    '{"ExprTuple":{"data":[{"ExprBool":{"data":true}},{"ExprString":{"data":"yes"}}]}}',
  ),
);
assert.deepEqual(ok, { ok: true, values: ["yes"] });
const refused = JSON.parse(
  wasm.decode_reply(
    '{"ExprTuple":{"data":[{"ExprBool":{"data":false}},{"ExprString":{"data":"status"}}]}}',
  ),
);
assert.deepEqual(refused, { ok: false, reason: "status" });

console.log("wasm-smoke: ok");
