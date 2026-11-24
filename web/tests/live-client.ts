/**
 * Live-client smoke against a running local devnet.
 *
 * Build the nodejs wasm target first (`make client-wasm-node`), then:
 *   npm --prefix web exec -- tsx web/tests/live-client.ts
 *
 * It uses the real term builders, WASM wallet/signing and HTTP transport. It creates a
 * fresh wallet, faucets it, founds a 1-of-1 publication, writes an article through its
 * lifecycle and seals a one-article edition. Every write must be finalized.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MemoryDeployLog } from "../src/lib/deploy-log";
import { LiveApi } from "../src/lib/live-api";
import { HttpTransport } from "../src/lib/node-client";
import type { LiveConfig } from "../src/lib/types";
import { RprintWasmBridge, type WasmModule } from "../src/lib/wasm-bridge";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const require = createRequire(import.meta.url);
const wasm = require(resolve(here, "wasm-node/rprint_wasm.js")) as WasmModule;

const nodeUrl = process.env.RPRINT_NODE ?? "http://localhost:50403";
const password = process.env.RPRINT_LIVE_PASSWORD ?? "live-smoke-password";

function rootUri(): string {
  if (process.env.RPRINT_ROOT) return process.env.RPRINT_ROOT;
  const manifest = JSON.parse(
    readFileSync(resolve(repo, "deployments/devnet.json"), "utf8"),
  ) as { root_uri?: string };
  assert.ok(manifest.root_uri, "deployments/devnet.json has no root_uri");
  return manifest.root_uri;
}

interface SiblingFixture {
  rsure?: { policyUri?: string; insured?: string; assetId?: string };
}

function siblingFixture(): SiblingFixture | null {
  if (process.env.RPRINT_SIBLINGS !== "1") return null;
  const path = process.env.RPRINT_SIBLING_FIXTURE
    ?? resolve(repo, "deployments/sibling-fixture.json");
  return JSON.parse(readFileSync(path, "utf8")) as SiblingFixture;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHeight(
  transport: HttpTransport,
  start: number,
  target: number,
): Promise<number> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const height = await transport.height();
    if (height >= start + target) return height;
    await sleep(500);
  }
  throw new Error("the devnet did not produce the expected blocks");
}

async function main() {
  const transport = new HttpTransport(nodeUrl);
  const status = await transport.status();
  const nodeName =
    (status as { version?: { node?: string } }).version?.node ?? "unknown";
  const startHeight = await transport.height();
  const fixture = siblingFixture();
  const policy = fixture?.rsure;
  const config: LiveConfig = {
    nodeUrl,
    rootUri: rootUri(),
    shardId: "/root",
    phloLimit: 4_000_000,
    phloPrice: 1,
    processedTimeoutMs: 120_000,
    finalityTimeoutMs: 120_000,
  };
  const log = new MemoryDeployLog();
  const bridge = new RprintWasmBridge(wasm);
  const api = new LiveApi({ bridge, transport, config, log });
  const steps: Array<Record<string, unknown>> = [];

  try {
    const wallet = bridge.createWallet(password);
    steps.push({ step: "create-wallet", address: wallet.address });
    assert.match(wallet.address, /^1111/);

    const beforeFaucet = await transport.height();
    await transport.faucet(wallet.address);
    await waitForHeight(transport, beforeFaucet, 2);
    steps.push({ step: "faucet", address: wallet.address });

    const suffix = Date.now().toString(36);
    const signerBridge = new RprintWasmBridge(wasm);
    const signer = signerBridge.createWallet(`${password}-signer`);
    const publicationId = `pub:live-${suffix}`;
    const created = await api.createPublication({
      publicationId,
      opId: `create:${suffix}`,
      charter: {
        nameHash: `name:${suffix}`,
        mastheadHash: `mast:${suffix}`,
        taglineHash: `tag:${suffix}`,
        foundedAtHeight: 0,
        treasuryAccountId: policy?.insured ?? wallet.address,
        assetId: "REV",
        revenueSplit: [],
        admins: [wallet.publicKey, signer.publicKey],
        threshold: 2,
        governance: {
          maxMembers: 32,
          requireFactCheck: false,
          requireKAsset: false,
          disputeWindowBlocks: 10,
          commissionGraceBlocks: 5,
          arbitrators: [],
          arbitrationThreshold: 0,
        },
      },
      members: [
        {
          memberId: wallet.address,
          role: "publisher",
          did: `byoid:rev:${wallet.address}`,
          attestationHash: `att:${suffix}`,
        },
      ],
    });
    assert.ok(created.ok, `create publication: ${JSON.stringify(created)}`);
    const publicationUri = created.value.uri;
    steps.push({ step: "create-publication", uri: publicationUri });

    const memberBridge = new RprintWasmBridge(wasm);
    const member = memberBridge.createWallet(`${password}-member`);
    const added = await api.addMember(publicationUri, {
      opId: `member:${suffix}`,
      memberId: member.address,
      role: "writer",
      did: `byoid:rev:${member.address}`,
      attestationHash: `att:member:${suffix}`,
    });
    assert.ok(added.ok, `add member: ${JSON.stringify(added)}`);
    steps.push({ step: "add-member", memberId: member.address });

    const proposalId = `commission:live-${suffix}`;
    const proposal = await api.proposeCommission({
      proposalId,
      opId: `commission:${suffix}`,
      publicationId,
      publicationUri,
      writerDid: `byoid:rev:${wallet.address}`,
      titleHash: `title:${suffix}`,
      briefHash: `brief:${suffix}`,
      total: 100,
      milestones: [
        {
          id: "m1",
          kind: "draft",
          amount: 100,
          deadlineHeight: (await transport.height()) + 100,
        },
      ],
      graceBlocks: 10,
      disputeWindowBlocks: 10,
      requireFactCheck: false,
    });
    assert.ok(proposal.ok, `propose commission: ${JSON.stringify(proposal)}`);
    const proposalUri = proposal.value.uri;
    const proposalRead = await api.commissionProposalInfo(proposalUri);
    assert.ok(proposalRead.ok && proposalRead.value.status === "proposed");
    steps.push({ step: "propose-commission", uri: proposalUri });

    if (policy?.policyUri) {
      const covered = await api.attachCover(proposalUri, {
        opId: `cover:${suffix}`,
        coverUri: policy.policyUri,
      });
      assert.ok(covered.ok, `attach cover: ${JSON.stringify(covered)}`);
      const coveredRead = await api.commissionProposalInfo(proposalUri);
      assert.ok(coveredRead.ok && coveredRead.value.coverStatus === "active");
      steps.push({ step: "attach-cover", policyUri: policy.policyUri });
    }

    const articleId = `article:live-${suffix}`;
    const article = await api.createArticle({
      articleId,
      opId: `article:${suffix}`,
      publicationId,
      publicationUri,
      authors: [
        {
          memberId: wallet.address,
          did: `byoid:rev:${wallet.address}`,
          bylineHash: `byline:${suffix}`,
        },
      ],
      contentHash: `content:${suffix}`,
      license: "cc-by-4.0",
      customLicenseHash: "",
      access: "open",
      sectionHash: `section:${suffix}`,
      requireFactCheck: false,
      requireKAsset: false,
    });
    assert.ok(article.ok, `create article: ${JSON.stringify(article)}`);
    const articleUri = article.value.uri;

    for (const [step, action] of [
      ["submit-article", () => api.submitArticle(articleUri, { opId: `submit:${suffix}`, contentHash: `content:${suffix}` })],
      ["approve-article", () => api.approveArticle(articleUri, { opId: `approve:${suffix}` })],
      ["publish-article", () => api.publishArticle(articleUri, { opId: `publish:${suffix}` })],
    ] as const) {
      const reply = await action();
      assert.ok(reply.ok, `${step}: ${JSON.stringify(reply)}`);
      steps.push({ step });
    }

    const editionId = `edition:live-${suffix}`;
    const edition = await api.createEdition({
      editionId,
      opId: `edition:${suffix}`,
      publicationId,
      publicationUri,
      number: 1,
      titleHash: `title:${suffix}`,
      coverHash: `cover:${suffix}`,
    });
    assert.ok(edition.ok, `create edition: ${JSON.stringify(edition)}`);
    const editionUri = edition.value.uri;

    const appended = await api.appendEditionArticle(editionUri, {
      opId: `append:${suffix}`,
      articleUri,
    });
    assert.ok(appended.ok, `append article: ${JSON.stringify(appended)}`);

    const editionState = await api.editionInfo(editionUri);
    assert.ok(editionState.ok, `edition info: ${JSON.stringify(editionState)}`);
    const signed = bridge.signEditionManifest({
      editionId: editionState.value.editionId,
      publicationId: editionState.value.publicationId,
      number: editionState.value.number,
      titleHash: editionState.value.titleHash,
      coverHash: editionState.value.coverHash,
      articleHashes: editionState.value.articles.map((entry) => entry.contentHash),
    });
    const sealed = await api.sealEdition(editionUri, {
      opId: `seal:${suffix}`,
      editorSig: signed.signature,
    });
    assert.ok(sealed.ok, `seal edition: ${JSON.stringify(sealed)}`);
    steps.push({ step: "seal-edition", manifestHash: signed.manifestHash });

    const readBack = await api.publicationInfo(publicationUri);
    assert.ok(readBack.ok, `read publication: ${JSON.stringify(readBack)}`);
    assert.equal(readBack.value.publicationId, publicationId);
    const articleRead = await api.articleInfo(articleUri);
    assert.ok(articleRead.ok, `read article: ${JSON.stringify(articleRead)}`);
    assert.equal(articleRead.value.status, "published");
    const editionRead = await api.editionInfo(editionUri);
    assert.ok(editionRead.ok, `read edition: ${JSON.stringify(editionRead)}`);
    assert.equal(editionRead.value.status, "sealed");
    steps.push({ step: "read-back", publicationId, articleUri, editionUri });

    // Multisig: fetch the canonical payload from the deployed Codec, sign with two
    // independent keystores, and pause the publication through Publication("admin").
    const payload = await api.payloadFor(
      `publication:${publicationId}`,
      1,
      "pause",
      [],
    );
    assert.ok(payload.ok, `admin payload: ${JSON.stringify(payload)}`);
    assert.ok(wallet.document, "first wallet document");
    assert.ok(signer.document, "second wallet document");
    const firstSignature = bridge.signWithKeystore(
      wallet.document,
      password,
      payload.value.payload,
    );
    const secondSignature = signerBridge.signWithKeystore(
      signer.document,
      `${password}-signer`,
      payload.value.payload,
    );
    const paused = await api.publicationAdmin(publicationUri, {
      nonce: 1,
      action: "pause",
      args: [],
      sigs: [firstSignature.signature, secondSignature.signature],
    });
    assert.ok(paused.ok, `pause: ${JSON.stringify(paused)}`);
    const pausedRead = await api.publicationInfo(publicationUri);
    assert.ok(pausedRead.ok && pausedRead.value.status === "paused");
    steps.push({ step: "admin-multisig-pause", threshold: 2 });

    const results = {
      pass: true,
      node: nodeUrl,
      nodeBuild: nodeName,
      startHeight,
      endHeight: await transport.height(),
      siblingCover: Boolean(policy?.policyUri),
      knowledge: "not_covered: the fresh WASM wallet cannot sign the r-gen claim",
      steps,
      deploys: log.list(),
    };
    mkdirSync(resolve(repo, "deployments"), { recursive: true });
    writeFileSync(
      resolve(repo, "deployments/live-client-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
    console.log(`live-client: ok (${nodeName}, ${steps.length} steps)`);
  } catch (error) {
    const results = {
      pass: false,
      node: nodeUrl,
      nodeBuild: nodeName,
      startHeight,
      steps,
      deploys: log.list(),
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
    mkdirSync(resolve(repo, "deployments"), { recursive: true });
    writeFileSync(
      resolve(repo, "deployments/live-client-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
