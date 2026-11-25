import { test, expect, type Locator } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clickSubmit,
  form,
  goHash,
  submitAndReply,
  type ReplyJson,
} from "../support/ui";
import { submitLabel } from "../support/forms";
import {
  LIVE_ENABLED,
  manifestJson,
  nodeBuild,
  nodeUrl,
  password,
  repoRoot,
  rootUri,
} from "../support/live-env";
import { height } from "../support/live-env";

function uriFrom(reply: ReplyJson): string {
  const value = reply.value;
  if (!value || typeof value !== "object" || !("uri" in value)) {
    throw new Error(`reply has no uri: ${JSON.stringify(reply)}`);
  }
  const uri = (value as { uri?: unknown }).uri;
  if (typeof uri !== "string") {
    throw new Error(`reply uri is not a string: ${JSON.stringify(reply)}`);
  }
  return uri;
}


async function selectByAddress(
  panel: Locator,
  selectLabel: string,
  address: string,
): Promise<void> {
  const option = panel.locator(`option[data-address="${address}"]`);
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`no keystore option for ${address}`);
  await panel
    .getByRole("combobox", { name: selectLabel, exact: true })
    .selectOption(value);
}

test("browser live journey: publication, article, edition, funded commission, multisig and refusal", async ({
  page,
  request,
}) => {
  test.skip(
    !LIVE_ENABLED,
    "set RPRINT_E2E_LIVE=1 with a healthy devnet; use make web-e2e-live",
  );

  const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const publicationId = `pub:e2e-${runId}`;
  const articleId = `article:e2e-${runId}`;
  const editionId = `edition:e2e-${runId}`;
  const commissionId = `commission:e2e-${runId}`;
  const contentHash = `content:e2e-${runId}`;
  const root = rootUri();
  const steps: string[] = [];
  let addressA = "";
  let publicKeyA = "";
  let addressB = "";
  let publicKeyB = "";
  let publicationUri = "";
  let articleUri = "";
  let editionUri = "";
  let proposalUri = "";
  let escrowUri = "";

  await test.step("fixture starting point", async () => {
    await page.goto("/#/network");
    await expect(page.getByRole("status")).toContainText("Fixture mode");
    steps.push("fixture-start");
  });

  await test.step("settings and live boot", async () => {
    await page.getByLabel("Node URL", { exact: true }).fill(nodeUrl);
    await page.getByTestId("manifest-input").fill(manifestJson());
    await page.getByRole("button", { name: "Use root_uri" }).click();
    await expect(page.getByLabel("Root URI", { exact: true })).toHaveValue(root);
    await page.getByRole("button", { name: "Save settings" }).click();
    await page
      .getByRole("combobox", { name: "Client mode", exact: true })
      .selectOption("live");
    await expect(page.getByRole("status")).toContainText("Live mode", {
      timeout: 120_000,
    });
    await expect(page.getByTestId("boot-error")).toHaveCount(0);
    steps.push("live-boot");
  });

  await test.step("network status and component resolution", async () => {
    await expect(page.getByTestId("network-status")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("node-endpoint")).toHaveText(nodeUrl);
    await expect(page.getByTestId("node-accepts")).toHaveText("yes");
    await expect(page.getByTestId("node-height")).not.toHaveText("0");
    await page
      .getByLabel("Component key", { exact: true })
      .fill("component:publication-factory");
    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByTestId("component-resolution")).toContainText("rho:id:", {
      timeout: 60_000,
    });
    steps.push("network-status-and-resolve");
  });

  await test.step("two keystores", async () => {
    await goHash(page, "#/keystore");
    await expect(
      page.getByRole("heading", { name: "Keystore", level: 1 }),
    ).toBeVisible();

    const create = page.getByTestId("form-keystoreCreate");
    await create.getByLabel("Label", { exact: true }).fill("e2e-admin-a");
    await create.getByLabel("Password", { exact: true }).fill(password);
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByTestId("keystore-message")).toContainText("Created", {
      timeout: 120_000,
    });
    addressA = (await page.getByTestId("session-address").textContent()) ?? "";
    publicKeyA = (await page.getByTestId("session-public-key").textContent()) ?? "";
    expect(addressA).not.toBe("—");
    expect(publicKeyA).not.toBe("—");

    await create.getByLabel("Label", { exact: true }).fill("e2e-publisher-b");
    await create.getByLabel("Password", { exact: true }).fill(password);
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByTestId("keystore-message")).toContainText("Created", {
      timeout: 120_000,
    });
    addressB = (await page.getByTestId("session-address").textContent()) ?? "";
    publicKeyB = (await page.getByTestId("session-public-key").textContent()) ?? "";
    expect(addressB).not.toBe(addressA);
    await expect(page.getByTestId("saved-keystore")).toHaveCount(2, {
      timeout: 60_000,
    });

    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByTestId("session-status")).toHaveText("locked");

    const unlock = page.getByTestId("form-keystoreUnlock");
    await selectByAddress(unlock, "Keystore", addressB);
    await unlock.getByLabel("Password", { exact: true }).fill(password);
    await unlock.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(page.getByTestId("keystore-message")).toContainText("Unlocked", {
      timeout: 120_000,
    });
    await expect(page.getByTestId("session-status")).toHaveText("unlocked");
    await expect(page.getByTestId("session-address")).toHaveText(addressB);
    steps.push("two-keystores");
  });

  await test.step("native faucet", async () => {
    await goHash(page, "#/network");
    const start = await height(request);
    await page.getByRole("button", { name: "Request 30 REV" }).click();
    await expect(page.getByTestId("faucet-result")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => height(request), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBeGreaterThanOrEqual(start + 2);
    steps.push("faucet");
  });

  await test.step("create a 2-of-2 publication", async () => {
    await goHash(page, "#/");
    const publication = form(page, "createPublication");
    await publication.getByLabel("Publication id", { exact: true }).fill(publicationId);
    await publication
      .getByLabel("Name hash", { exact: true })
      .fill(`name:e2e-${runId}`);
    await publication
      .getByLabel("Masthead hash", { exact: true })
      .fill(`masthead:e2e-${runId}`);
    await publication
      .getByLabel("Tagline hash", { exact: true })
      .fill(`tagline:e2e-${runId}`);
    await publication
      .getByLabel("Admin public keys", { exact: true })
      .fill(`${publicKeyA},${publicKeyB}`);
    await publication.getByLabel("Admin threshold", { exact: true }).fill("2");
    await publication
      .getByLabel("Attestation hash", { exact: true })
      .fill(`att:e2e-${runId}`);

    const reply = await submitAndReply(publication, "Create publication");
    expect(reply.ok, JSON.stringify(reply)).toBe(true);
    publicationUri = uriFrom(reply);
    await expect(
      page.locator(
        `[data-testid="catalogue-entry"][data-uri="${publicationUri}"]`,
      ),
    ).toBeVisible({ timeout: 60_000 });
    steps.push("create-publication");
  });

  await test.step("add a writer", async () => {
    await goHash(
      page,
      `#/publication/${encodeURIComponent(publicationUri)}/members`,
    );
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible({
      timeout: 60_000,
    });
    const add = form(page, "addMember");
    await add.getByLabel("REV address", { exact: true }).fill(addressA);
    await add
      .getByRole("combobox", { name: "Role", exact: true })
      .selectOption("writer");
    await add
      .getByLabel("DID (interface only)", { exact: true })
      .fill(`byoid:rev:${addressA}`);
    await add
      .getByLabel("Attestation hash", { exact: true })
      .fill(`att:e2e-a-${runId}`);
    const reply = await submitAndReply(add, submitLabel("addMember"));
    expect(reply.ok, JSON.stringify(reply)).toBe(true);
    await expect(
      page.locator(
        `[data-testid="member-row"][data-member-id="${addressA}"]`,
      ),
    ).toHaveAttribute("data-role", "writer", { timeout: 60_000 });
    steps.push("add-member");
  });

  await test.step("article create, submit, approve, publish", async () => {
    await goHash(page, "#/");
    const create = form(page, "createArticle");
    await create.getByLabel("Article id", { exact: true }).fill(articleId);
    await create
      .getByLabel("Publication id", { exact: true })
      .fill(publicationId);
    await create
      .getByLabel("Canonical publication URI", { exact: true })
      .fill(publicationUri);
    await create.getByLabel("Content hash", { exact: true }).fill(contentHash);
    const created = await submitAndReply(create, "Create article");
    expect(created.ok, JSON.stringify(created)).toBe(true);
    articleUri = uriFrom(created);

    await goHash(page, `#/article/${encodeURIComponent(articleUri)}`);
    const submit = form(page, "submitArticle");
    await submit.getByLabel("Content hash", { exact: true }).fill(contentHash);
    await clickSubmit(submit, submitLabel("submitArticle"));
    await expect(page.getByTestId("article-status")).toHaveAttribute(
      "data-status",
      "submitted",
      { timeout: 300_000 },
    );

    const approve = form(page, "approveArticle");
    await clickSubmit(approve, submitLabel("approveArticle"));
    await expect(page.getByTestId("article-status")).toHaveAttribute(
      "data-status",
      "approved",
      { timeout: 300_000 },
    );

    const publish = form(page, "publishArticle");
    await clickSubmit(publish, submitLabel("publishArticle"));
    await expect(page.getByTestId("article-status")).toHaveAttribute(
      "data-status",
      "published",
      { timeout: 300_000 },
    );
    steps.push("article-lifecycle");
  });

  await test.step("edition create, append, seal", async () => {
    await goHash(
      page,
      `#/publication/${encodeURIComponent(publicationUri)}`,
    );
    const create = form(page, "createEdition");
    await expect(create.getByLabel("Publication id", { exact: true })).toHaveValue(
      publicationId,
      { timeout: 60_000 },
    );
    await expect(
      create.getByLabel("Canonical publication URI", { exact: true }),
    ).toHaveValue(publicationUri);
    await create.getByLabel("Edition id", { exact: true }).fill(editionId);
    await create
      .getByLabel("Title hash", { exact: true })
      .fill(`title:e2e-${runId}`);
    await create
      .getByLabel("Cover hash", { exact: true })
      .fill(`cover:e2e-${runId}`);
    const created = await submitAndReply(create, "Create edition");
    expect(created.ok, JSON.stringify(created)).toBe(true);
    editionUri = uriFrom(created);

    await goHash(page, `#/edition/${encodeURIComponent(editionUri)}`);
    const append = form(page, "appendEditionArticle");
    await append.getByLabel("Article URI", { exact: true }).fill(articleUri);
    await clickSubmit(append, submitLabel("appendEditionArticle"));
    await expect(page.getByRole("link", { name: articleId })).toBeVisible({
      timeout: 300_000,
    });

    const seal = form(page, "sealEdition");
    await clickSubmit(seal, "Sign and seal");
    await expect(page.getByTestId("edition-status")).toHaveAttribute(
      "data-status",
      "sealed",
      { timeout: 300_000 },
    );
    steps.push("edition-create-append-seal");
  });

  await test.step("fund a commission from the browser", async () => {
    await goHash(page, "#/keystore");
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByTestId("session-status")).toHaveText("locked");
    const unlockA = page.getByTestId("form-keystoreUnlock");
    await selectByAddress(unlockA, "Keystore", addressA);
    await unlockA.getByLabel("Password", { exact: true }).fill(password);
    await unlockA.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(page.getByTestId("session-address")).toHaveText(addressA);

    await goHash(page, "#/network");
    const writerFaucetStart = await height(request);
    await page.getByRole("button", { name: "Request 30 REV" }).click();
    await expect(page.getByTestId("faucet-result")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => height(request), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBeGreaterThanOrEqual(writerFaucetStart + 2);
    steps.push("faucet-writer");

    await goHash(page, "#/");
    const deadline = (await height(request)) + 500;
    const propose = form(page, "proposeCommission");
    await propose.getByLabel("Proposal id", { exact: true }).fill(commissionId);
    await propose.getByLabel("Publication id", { exact: true }).fill(publicationId);
    await propose
      .getByLabel("Canonical publication URI", { exact: true })
      .fill(publicationUri);
    await propose.getByLabel("Writer DID", { exact: true }).fill(`byoid:rev:${addressA}`);
    await propose
      .getByLabel("Title hash", { exact: true })
      .fill(`title:commission:e2e-${runId}`);
    await propose
      .getByLabel("Brief hash", { exact: true })
      .fill(`brief:e2e-${runId}`);
    await propose.getByLabel("Total (minor units)", { exact: true }).fill("5");
    await propose.getByLabel("Amount", { exact: true }).fill("5");
    await propose.getByLabel("Deadline height", { exact: true }).fill(String(deadline));
    const proposed = await submitAndReply(propose, "Propose commission");
    expect(proposed.ok, JSON.stringify(proposed)).toBe(true);
    proposalUri = uriFrom(proposed);
    await goHash(page, `#/commission/${encodeURIComponent(proposalUri)}`);
    await expect(page.getByTestId("proposal-status")).toHaveAttribute(
      "data-status",
      "proposed",
      { timeout: 300_000 },
    );
    steps.push("propose-commission");

    await goHash(page, "#/keystore");
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByTestId("session-status")).toHaveText("locked");
    const unlockB = page.getByTestId("form-keystoreUnlock");
    await selectByAddress(unlockB, "Keystore", addressB);
    await unlockB.getByLabel("Password", { exact: true }).fill(password);
    await unlockB.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(page.getByTestId("session-address")).toHaveText(addressB);

    await goHash(page, "#/network");
    const publisherFaucetStart = await height(request);
    await page.getByRole("button", { name: "Request 30 REV" }).click();
    await expect(page.getByTestId("faucet-result")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => height(request), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBeGreaterThanOrEqual(publisherFaucetStart + 2);
    await page.getByLabel("Deposit amount (REV)", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Deposit REV" }).click();
    await expect(page.getByTestId("deposit-result")).toBeVisible({ timeout: 300_000 });
    await expect(page.getByTestId("deposit-result")).toContainText("Funded");
    steps.push("deposit-r-cash");

    await goHash(page, `#/commission/${encodeURIComponent(proposalUri)}`);
    const accept = form(page, "acceptProposal");
    await clickSubmit(accept, "Submit");
    await expect(page.getByTestId("proposal-status")).toHaveAttribute(
      "data-status",
      "accepted",
      { timeout: 300_000 },
    );
    const fund = form(page, "fundProposal");
    await clickSubmit(fund, "Submit");
    await expect(page.getByTestId("proposal-status")).toHaveAttribute(
      "data-status",
      "funded",
      { timeout: 300_000 },
    );
    const openEscrow = page.getByRole("link", { name: "Open escrow" });
    await expect(openEscrow).toBeVisible({ timeout: 60_000 });
    const href = await openEscrow.getAttribute("href");
    if (!href) throw new Error("funded proposal has no escrow link");
    escrowUri = decodeURIComponent(href.replace(/^#\/escrow\//, ""));
    steps.push("fund-commission");

    await goHash(page, `#/escrow/${encodeURIComponent(escrowUri)}`);
    await expect(page.getByTestId("escrow-status")).toHaveAttribute(
      "data-status",
      "active",
      { timeout: 60_000 },
    );
    steps.push("read-escrow");
  });

  await test.step("admin multisig pause", async () => {
    await goHash(
      page,
      `#/publication/${encodeURIComponent(publicationUri)}`,
    );
    await expect(page.getByTestId("publication-status")).toHaveAttribute(
      "data-status",
      "active",
      { timeout: 60_000 },
    );
    const admin = form(page, "publicationAdmin");
    await expect(
      admin.getByLabel("Nonce (must be above the stored nonce)", {
        exact: true,
      }),
    ).toHaveValue("1", { timeout: 60_000 });
    await expect(
      admin.getByRole("combobox", { name: "Action", exact: true }),
    ).toHaveValue("pause");
    await admin.getByRole("button", { name: "Prepare payload" }).click();
    await expect(admin.getByTestId("multisig-payload")).toContainText(
      "rprint:admin:v1|publication:",
      { timeout: 60_000 },
    );

    const multisig = admin.getByTestId("multisig");
    await selectByAddress(multisig, "Signer keystore", addressA);
    await multisig
      .getByLabel("Keystore password", { exact: true })
      .fill(password);
    await multisig.getByRole("button", { name: "Sign payload" }).click();
    await expect(multisig.getByTestId("multisig-count")).toContainText("1/2", {
      timeout: 60_000,
    });

    await selectByAddress(multisig, "Signer keystore", addressB);
    await multisig
      .getByLabel("Keystore password", { exact: true })
      .fill(password);
    await multisig.getByRole("button", { name: "Sign payload" }).click();
    await expect(multisig.getByTestId("multisig-count")).toContainText("2/2", {
      timeout: 60_000,
    });

    await clickSubmit(admin, "Submit admin action");
    await expect(page.getByTestId("publication-status")).toHaveAttribute(
      "data-status",
      "paused",
      { timeout: 300_000 },
    );
    steps.push("admin-multisig-pause");
  });

  await test.step("deliberate refusal", async () => {
    await goHash(page, "#/");
    const refused = form(page, "createArticle");
    await refused
      .getByLabel("Article id", { exact: true })
      .fill(`article:e2e-refused-${runId}`);
    await refused
      .getByLabel("Publication id", { exact: true })
      .fill(publicationId);
    await refused
      .getByLabel("Canonical publication URI", { exact: true })
      .fill(publicationUri);
    await refused
      .getByLabel("Content hash", { exact: true })
      .fill(`content:refused-${runId}`);
    const reply = await submitAndReply(refused, "Create article");
    expect(reply.ok).toBe(false);
    expect(String(reply.reason)).toContain("paused");
    await expect(refused.getByTestId("form-reply")).toHaveAttribute(
      "data-ok",
      "false",
    );
    steps.push("refusal-paused");
  });

  await test.step("deploy history and finality evidence", async () => {
    await goHash(page, "#/deploy");
    await expect(page.getByTestId("deploy-row")).toHaveCount(15, {
      timeout: 60_000,
    });
    const finalized = page.locator(
      '[data-testid="deploy-row"][data-status="finalized"]',
    );
    const refused = page.locator(
      '[data-testid="deploy-row"][data-status="refused"]',
    );
    await expect(finalized).toHaveCount(14);
    await expect(refused).toHaveCount(1);
    const evidence = await finalized.evaluateAll((rows) =>
      rows.map((row) => ({
        deployId: row.getAttribute("data-deploy-id"),
        block: row.getAttribute("data-block-number"),
      })),
    );
    for (const row of evidence) {
      expect(row.deployId).toBeTruthy();
      expect(row.block).toBeTruthy();
    }
    steps.push("deploy-history");
  });

  await test.step("reload and read everything back", async () => {
    await page.reload();
    await expect(page.getByRole("status")).toContainText("Live mode", {
      timeout: 120_000,
    });
    await expect(page.getByRole("status")).toHaveAttribute(
      "data-unlocked",
      "false",
    );
    await expect(page.getByTestId("deploy-row")).toHaveCount(15, {
      timeout: 60_000,
    });
    await expect(
      page.locator('[data-testid="deploy-row"][data-status="finalized"]'),
    ).toHaveCount(14);
    await expect(
      page.locator('[data-testid="deploy-row"][data-status="refused"]'),
    ).toHaveCount(1);

    await goHash(page, "#/network");
    await expect(page.getByLabel("Node URL", { exact: true })).toHaveValue(nodeUrl);
    await expect(page.getByLabel("Root URI", { exact: true })).toHaveValue(root);

    await goHash(page, "#/keystore");
    await expect(page.getByTestId("saved-keystore")).toHaveCount(2, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("session-status")).toHaveText("locked");

    await goHash(
      page,
      `#/publication/${encodeURIComponent(publicationUri)}`,
    );
    await expect(page.getByTestId("publication-status")).toHaveAttribute(
      "data-status",
      "paused",
      { timeout: 60_000 },
    );
    await expect(
      page.locator(
        `[data-testid="member-row"][data-member-id="${addressA}"]`,
      ),
    ).toHaveAttribute("data-role", "writer", { timeout: 60_000 });

    await goHash(page, `#/article/${encodeURIComponent(articleUri)}`);
    await expect(page.getByTestId("article-status")).toHaveAttribute(
      "data-status",
      "published",
      { timeout: 60_000 },
    );

    await goHash(page, `#/edition/${encodeURIComponent(editionUri)}`);
    await expect(page.getByTestId("edition-status")).toHaveAttribute(
      "data-status",
      "sealed",
      { timeout: 60_000 },
    );

    await goHash(page, `#/escrow/${encodeURIComponent(escrowUri)}`);
    await expect(page.getByTestId("escrow-status")).toHaveAttribute(
      "data-status",
      "active",
      { timeout: 60_000 },
    );
    steps.push("reload-read-back");
  });

  const results = {
    pass: true,
    node: nodeUrl,
    nodeBuild: await nodeBuild(request),
    rootUri: root,
    runId,
    addresses: { adminA: addressA, publisherB: addressB },
    publicationUri,
    articleUri,
    editionUri,
    proposalUri,
    escrowUri,
    finalized: 14,
    refused: 1,
    methods: ["publicationAdmin", "escrowInfo"],
    steps,
  };
  mkdirSync(resolve(repoRoot(), "deployments"), { recursive: true });
  writeFileSync(
    resolve(repoRoot(), "deployments/browser-e2e-results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});
