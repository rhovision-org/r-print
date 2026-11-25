/**
 * Live-client smoke against a running local devnet.
 *
 * Build the nodejs wasm target first (`make client-wasm-node`), then:
 *   RPRINT_SIBLINGS=1 npm --prefix web exec -- tsx web/tests/live-client.ts
 *
 * It uses the real term builders, WASM wallet/signing and HTTP transport. It creates a
 * fresh wallet, faucets it, founds a publication, exercises the publication, commission,
 * article, edition and coordination surfaces, and records every method it credits in
 * `deployments/live-client-results.json`. Every write must be finalized.
 *
 * The run requires the pinned sibling roots and `deployments/sibling-fixture.json` with an
 * active r-sure policy, because `attachCover` is part of the recorded client surface.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MemoryDeployLog } from "../src/lib/deploy-log";
import { LiveApi } from "../src/lib/live-api";
import { HttpTransport } from "../src/lib/node-client";
import type { LiveConfig, Reply } from "../src/lib/types";
import { RprintWasmBridge, type WasmModule } from "../src/lib/wasm-bridge";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const require = createRequire(import.meta.url);
const wasm = require(resolve(here, "wasm-node/rprint_wasm.js")) as WasmModule;

const nodeUrl = process.env.RPRINT_NODE ?? "http://localhost:50403";
const password = process.env.RPRINT_LIVE_PASSWORD ?? "live-smoke-password";

/** Every map row credited to this test. `check-client-ops` enforces the list. */
const REQUIRED_METHODS = [
  "resolveComponent",
  "networkStatus",
  "publicationInfo",
  "publicationCharter",
  "publicationArbitration",
  "publicationMembers",
  "commissionProposalInfo",
  "articleInfo",
  "editionInfo",
  "coordinationInfo",
  "createPublication",
  "addMember",
  "setRole",
  "attestSelf",
  "removeMember",
  "pausePublication",
  "attachCover",
  "proposeCommission",
  "cancelProposal",
  "createCoordination",
  "recordCoordination",
  "createArticle",
  "submitArticle",
  "attestArticle",
  "approveArticle",
  "publishArticle",
  "correctArticle",
  "retractArticle",
  "createEdition",
  "appendEditionArticle",
  "sealEdition",
  "keystoreCreate",
  "keystoreUnlock",
] as const;

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
  const methods = new Set<string>();

  function credit<T>(name: string, reply: Reply<T>): T {
    if (!reply.ok) throw new Error(`${name}: ${reply.reason}`);
    methods.add(name);
    return reply.value;
  }

  try {
    // The recorded surface includes attachCover, so a run without the sibling policy would
    // produce an artifact that cannot satisfy the client-op map.
    if (!policy?.policyUri) {
      throw new Error(
        "RPRINT_SIBLINGS=1 and deployments/sibling-fixture.json with rsure.policyUri are required",
      );
    }
    const coverUri = policy.policyUri;

    const resolved = credit(
      "resolveComponent",
      await api.resolveComponent("component:coordination-factory"),
    );
    assert.match(resolved.uri, /^rho:id:/);
    const network = credit("networkStatus", await api.networkStatus());
    assert.equal(network.node, nodeUrl);
    steps.push({ step: "network-status-and-resolve", uri: resolved.uri });

    const key = credit("keystoreCreate", await api.keystoreCreate({ password }));
    assert.match(key.address, /^1111/);
    assert.ok(key.document, "keystore document");
    const walletInfo = bridge.info();
    assert.ok(walletInfo, "wallet info");
    const wallet = {
      address: key.address,
      publicKey: walletInfo.publicKey,
      document: key.document,
    };
    steps.push({ step: "create-wallet", address: wallet.address });

    const beforeFaucet = await transport.height();
    await transport.faucet(wallet.address);
    await waitForHeight(transport, beforeFaucet, 2);
    steps.push({ step: "faucet", address: wallet.address });

    const suffix = Date.now().toString(36);
    const signerBridge = new RprintWasmBridge(wasm);
    const signer = signerBridge.createWallet(`${password}-signer`);
    const publicationId = `pub:live-${suffix}`;
    const created = credit(
      "createPublication",
      await api.createPublication({
        publicationId,
        opId: `create:${suffix}`,
        charter: {
          nameHash: `name:${suffix}`,
          mastheadHash: `mast:${suffix}`,
          taglineHash: `tag:${suffix}`,
          foundedAtHeight: 0,
          treasuryAccountId: policy.insured ?? wallet.address,
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
      }),
    );
    const publicationUri = created.uri;
    steps.push({ step: "create-publication", uri: publicationUri });

    const charter = credit(
      "publicationCharter",
      await api.publicationCharter(publicationUri),
    );
    assert.equal(charter.nameHash, `name:${suffix}`);
    assert.equal(charter.mastheadHash, `mast:${suffix}`);
    assert.equal(charter.assetId, "REV");
    assert.equal(charter.treasuryAccountId, policy.insured ?? wallet.address);
    steps.push({ step: "read-publication-charter" });

    const arbitration = credit(
      "publicationArbitration",
      await api.publicationArbitration(publicationUri),
    );
    assert.ok(arbitration.kind === "publication" || arbitration.kind === "platform");
    assert.ok(arbitration.threshold > 0);
    assert.ok(arbitration.keys.length >= arbitration.threshold);
    steps.push({ step: "read-publication-arbitration", kind: arbitration.kind });

    const memberBridge = new RprintWasmBridge(wasm);
    const member = memberBridge.createWallet(`${password}-member`);
    credit(
      "addMember",
      await api.addMember(publicationUri, {
        opId: `member:${suffix}`,
        memberId: member.address,
        role: "writer",
        did: `byoid:rev:${member.address}`,
        attestationHash: `att:member:${suffix}`,
      }),
    );
    steps.push({ step: "add-member", memberId: member.address });

    credit(
      "setRole",
      await api.setRole(publicationUri, {
        opId: `setrole:${suffix}`,
        memberId: member.address,
        role: "editor",
      }),
    );
    const afterRole = credit(
      "publicationMembers",
      await api.publicationMembers(publicationUri),
    );
    const memberAfterRole = afterRole[member.address];
    assert.ok(memberAfterRole, "member after setRole");
    assert.equal(memberAfterRole.role, "editor");
    steps.push({ step: "set-role", memberId: member.address, role: "editor" });

    const selfDid = `did:live:${suffix}`;
    const selfAttestation = `att:self:${suffix}`;
    credit(
      "attestSelf",
      await api.attestSelf(publicationUri, {
        opId: `attestself:${suffix}`,
        memberId: wallet.address,
        did: selfDid,
        attestationHash: selfAttestation,
      }),
    );
    const afterAttest = credit(
      "publicationMembers",
      await api.publicationMembers(publicationUri),
    );
    const walletAfterAttest = afterAttest[wallet.address];
    assert.ok(walletAfterAttest, "wallet after attestSelf");
    assert.equal(walletAfterAttest.did, selfDid);
    assert.equal(walletAfterAttest.attestationHash, selfAttestation);
    assert.equal(walletAfterAttest.role, "publisher");
    steps.push({ step: "attest-self", did: selfDid });

    const proposalId = `commission:live-${suffix}`;
    const proposal = credit(
      "proposeCommission",
      await api.proposeCommission({
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
      }),
    );
    const proposalUri = proposal.uri;
    const proposalRead = credit(
      "commissionProposalInfo",
      await api.commissionProposalInfo(proposalUri),
    );
    assert.equal(proposalRead.status, "proposed");
    steps.push({ step: "propose-commission", uri: proposalUri });

    credit(
      "attachCover",
      await api.attachCover(proposalUri, {
        opId: `cover:${suffix}`,
        coverUri,
      }),
    );
    const coveredRead = credit(
      "commissionProposalInfo",
      await api.commissionProposalInfo(proposalUri),
    );
    assert.equal(coveredRead.coverStatus, "active");
    steps.push({ step: "attach-cover", policyUri: coverUri });

    const cancelProposalId = `commission:cancel-${suffix}`;
    const cancelProposal = credit(
      "proposeCommission",
      await api.proposeCommission({
        proposalId: cancelProposalId,
        opId: `commission:cancel:${suffix}`,
        publicationId,
        publicationUri,
        writerDid: `byoid:rev:${wallet.address}`,
        titleHash: `title:cancel:${suffix}`,
        briefHash: `brief:cancel:${suffix}`,
        total: 10,
        milestones: [
          {
            id: "m1",
            kind: "draft",
            amount: 10,
            deadlineHeight: (await transport.height()) + 100,
          },
        ],
        graceBlocks: 10,
        disputeWindowBlocks: 10,
        requireFactCheck: false,
      }),
    );
    credit(
      "cancelProposal",
      await api.cancelProposal(cancelProposal.uri, {
        opId: `cancel:${suffix}`,
        reasonHash: `cancel-reason:${suffix}`,
      }),
    );
    const cancelledRead = credit(
      "commissionProposalInfo",
      await api.commissionProposalInfo(cancelProposal.uri),
    );
    assert.equal(cancelledRead.status, "cancelled");
    steps.push({ step: "cancel-proposal", uri: cancelProposal.uri });

    const articleId = `article:live-${suffix}`;
    const article = credit(
      "createArticle",
      await api.createArticle({
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
      }),
    );
    const articleUri = article.uri;

    credit(
      "submitArticle",
      await api.submitArticle(articleUri, {
        opId: `submit:${suffix}`,
        contentHash: `content:${suffix}`,
      }),
    );
    credit(
      "attestArticle",
      await api.attestArticle(articleUri, {
        opId: `attest:${suffix}`,
        attestationId: `attestation:${suffix}`,
        kind: "editor",
        evidenceHash: `evidence:${suffix}`,
      }),
    );
    const submitted = credit("articleInfo", await api.articleInfo(articleUri));
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.attestations.length, 1);
    steps.push({ step: "attest-article", attestations: 1 });

    credit(
      "approveArticle",
      await api.approveArticle(articleUri, { opId: `approve:${suffix}` }),
    );
    credit(
      "publishArticle",
      await api.publishArticle(articleUri, { opId: `publish:${suffix}` }),
    );
    const published = credit("articleInfo", await api.articleInfo(articleUri));
    assert.equal(published.status, "published");
    steps.push({ step: "article-lifecycle" });

    const editionId = `edition:live-${suffix}`;
    const edition = credit(
      "createEdition",
      await api.createEdition({
        editionId,
        opId: `edition:${suffix}`,
        publicationId,
        publicationUri,
        number: 1,
        titleHash: `title:${suffix}`,
        coverHash: `cover:${suffix}`,
      }),
    );
    const editionUri = edition.uri;

    credit(
      "appendEditionArticle",
      await api.appendEditionArticle(editionUri, {
        opId: `append:${suffix}`,
        articleUri,
      }),
    );

    const editionState = credit(
      "editionInfo",
      await api.editionInfo(editionUri),
    );
    const signed = bridge.signEditionManifest({
      editionId: editionState.editionId,
      publicationId: editionState.publicationId,
      number: editionState.number,
      titleHash: editionState.titleHash,
      coverHash: editionState.coverHash,
      articleHashes: editionState.articles.map((entry) => entry.contentHash),
    });
    credit(
      "sealEdition",
      await api.sealEdition(editionUri, {
        opId: `seal:${suffix}`,
        editorSig: signed.signature,
      }),
    );
    const editionRead = credit("editionInfo", await api.editionInfo(editionUri));
    assert.equal(editionRead.status, "sealed");
    steps.push({ step: "seal-edition", manifestHash: signed.manifestHash });

    const coordinationId = `coord:live-${suffix}`;
    const pollIdHash = `poll:live-${suffix}`;
    const outcomeHash = `outcome:live-${suffix}`;
    const coordination = credit(
      "createCoordination",
      await api.createCoordination({
        opId: `coord:${suffix}`,
        coordinationId,
        publicationId,
        publicationUri,
        subjectKind: "article",
        subjectId: articleId,
        subjectUri: articleUri,
        roomIdHash: `room:live-${suffix}`,
        signerIds: [wallet.address, member.address],
      }),
    );
    const coordinationUri = coordination.uri;
    const open = credit(
      "coordinationInfo",
      await api.coordinationInfo(coordinationUri),
    );
    assert.equal(open.status, "open");
    assert.deepEqual(open.signers, [wallet.address, member.address]);
    assert.equal(open.pollIdHash, "");
    assert.equal(open.signatures.length, 0);
    steps.push({ step: "create-coordination", uri: coordinationUri });

    const publicationBefore = credit(
      "publicationInfo",
      await api.publicationInfo(publicationUri),
    );
    const memberDocument = member.document;
    assert.ok(memberDocument, "member document");
    const canonical =
      `rprint:coord:v1|${coordinationId}|${pollIdHash}|${outcomeHash}`;
    const walletSignature = bridge.signWithKeystore(
      wallet.document,
      password,
      canonical,
    );
    const memberSignature = memberBridge.signWithKeystore(
      memberDocument,
      `${password}-member`,
      canonical,
    );
    credit(
      "recordCoordination",
      await api.recordCoordination(coordinationUri, {
        opId: `record:${suffix}`,
        coordinationId,
        pollIdHash,
        outcomeHash,
        signatures: [
          {
            memberId: wallet.address,
            pubKey: walletSignature.publicKey,
            sig: walletSignature.signature,
          },
          {
            memberId: member.address,
            pubKey: memberSignature.publicKey,
            sig: memberSignature.signature,
          },
        ],
      }),
    );
    const recorded = credit(
      "coordinationInfo",
      await api.coordinationInfo(coordinationUri),
    );
    assert.equal(recorded.status, "recorded");
    assert.equal(recorded.signatures.length, 2);
    assert.ok(recorded.recordedAtHeight > 0);
    assert.equal(recorded.pollIdHash, pollIdHash);
    assert.equal(recorded.outcomeHash, outcomeHash);
    const publicationAfter = credit(
      "publicationInfo",
      await api.publicationInfo(publicationUri),
    );
    assert.deepEqual(publicationAfter, publicationBefore);
    steps.push({ step: "record-coordination", signatures: 2 });

    credit(
      "correctArticle",
      await api.correctArticle(articleUri, {
        opId: `correct:${suffix}`,
        correctionId: `correction:${suffix}`,
        kind: "correction",
        bodyHash: `body:${suffix}`,
        reasonHash: `reason:${suffix}`,
      }),
    );
    const corrected = credit("articleInfo", await api.articleInfo(articleUri));
    assert.equal(corrected.status, "published");
    assert.equal(corrected.contentHash, `content:${suffix}`);
    assert.equal(corrected.corrections.length, 1);

    credit(
      "retractArticle",
      await api.retractArticle(articleUri, {
        opId: `retract:${suffix}`,
        reasonHash: `retract-reason:${suffix}`,
      }),
    );
    const retracted = credit("articleInfo", await api.articleInfo(articleUri));
    assert.equal(retracted.status, "retracted");
    assert.ok(retracted.retractHeight > 0);
    assert.equal(retracted.corrections.length, 2);
    steps.push({ step: "correct-and-retract", corrections: 2 });

    credit(
      "removeMember",
      await api.removeMember(publicationUri, {
        opId: `remove:${suffix}`,
        memberId: member.address,
      }),
    );
    const afterRemoval = credit(
      "publicationMembers",
      await api.publicationMembers(publicationUri),
    );
    assert.equal(afterRemoval[member.address]?.status, "removed");
    assert.equal(afterRemoval[wallet.address]?.status, "active");
    steps.push({ step: "remove-member", memberId: member.address });

    credit(
      "pausePublication",
      await api.pausePublication(publicationUri, {
        opId: `pauseon:${suffix}`,
        paused: true,
      }),
    );
    const paused = credit(
      "publicationInfo",
      await api.publicationInfo(publicationUri),
    );
    assert.equal(paused.status, "paused");
    credit(
      "pausePublication",
      await api.pausePublication(publicationUri, {
        opId: `pauseoff:${suffix}`,
        paused: false,
      }),
    );
    const resumed = credit(
      "publicationInfo",
      await api.publicationInfo(publicationUri),
    );
    assert.equal(resumed.status, "active");
    steps.push({ step: "pause-resume" });

    // Multisig: fetch the canonical payload from the deployed Codec, sign with two
    // independent keystores, and pause the publication through Publication("admin").
    const payload = await api.payloadFor(
      `publication:${publicationId}`,
      1,
      "pause",
      [],
    );
    assert.ok(payload.ok, `admin payload: ${JSON.stringify(payload)}`);
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
    credit(
      "publicationAdmin",
      await api.publicationAdmin(publicationUri, {
        nonce: 1,
        action: "pause",
        args: [],
        sigs: [firstSignature.signature, secondSignature.signature],
      }),
    );
    const adminRead = credit(
      "publicationInfo",
      await api.publicationInfo(publicationUri),
    );
    assert.equal(adminRead.status, "paused");
    assert.equal(adminRead.nonce, 1);
    steps.push({ step: "admin-multisig-pause", threshold: 2 });

    // Unlock on a fresh bridge so the main wallet is not replaced.
    const unlockBridge = new RprintWasmBridge(wasm);
    const unlockApi = new LiveApi({
      bridge: unlockBridge,
      transport,
      config,
      log,
    });
    const unlocked = credit(
      "keystoreUnlock",
      await unlockApi.keystoreUnlock({
        password,
        document: wallet.document,
      }),
    );
    assert.equal(unlocked.address, wallet.address);
    steps.push({ step: "keystore-unlock", address: unlocked.address });

    const missing = REQUIRED_METHODS.filter((name) => !methods.has(name));
    assert.deepEqual(missing, [], `missing live methods: ${missing.join(", ")}`);

    const results = {
      pass: true,
      node: nodeUrl,
      nodeBuild: nodeName,
      startHeight,
      endHeight: await transport.height(),
      siblingCover: true,
      knowledge: "not_covered: the fresh WASM wallet cannot sign the r-gen claim",
      methods: [...methods].sort(),
      required: REQUIRED_METHODS.length,
      missing,
      steps,
      deploys: log.list(),
    };
    mkdirSync(resolve(repo, "deployments"), { recursive: true });
    writeFileSync(
      resolve(repo, "deployments/live-client-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
    console.log(
      `live-client: ok (${nodeName}, ${steps.length} steps, ${methods.size} methods)`,
    );
  } catch (error) {
    const results = {
      pass: false,
      node: nodeUrl,
      nodeBuild: nodeName,
      startHeight,
      methods: [...methods].sort(),
      required: REQUIRED_METHODS.length,
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
