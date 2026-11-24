import { test, expect } from "../support/fixture-test";
import { FIXTURES } from "../support/forms";

const enc = encodeURIComponent;

test.describe("fixture routes", () => {
  test("home renders the reference catalogue and the three create forms", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByRole("status")).toContainText("Fixture mode");
    await expect(
      page.getByRole("heading", { name: "A publication is an organisation." }),
    ).toBeVisible();
    await expect(page.getByTestId("catalogue-entry")).toHaveCount(4);
    for (const method of ["createPublication", "proposeCommission", "createArticle"]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("publication renders charter, roster, arbitration and the admin forms", async ({
    page,
  }) => {
    await page.goto(`/#/publication/${enc(FIXTURES.publication)}`);
    await expect(page.getByRole("status")).toContainText("Fixture mode");
    await expect(page.getByRole("heading", { name: "pub:kindling" })).toBeVisible();
    await expect(page.getByTestId("publication-status")).toHaveAttribute(
      "data-status",
      "active",
    );
    await expect(page.getByText("1 key(s), threshold 1 (solo)")).toBeVisible();
    await expect(
      page.getByText("platform PrintAdmin fallback (solo publication)"),
    ).toBeVisible();
    await expect(page.getByText("publication · 1-of-1")).toBeVisible();
    await expect(page.getByTestId("member-row")).toHaveCount(4);
    for (const role of ["publisher", "editor", "writer", "factchecker"]) {
      await expect(
        page.locator(`[data-testid="member-row"][data-role="${role}"]`),
      ).toHaveCount(1);
    }
    await expect(page.getByText("Cover policy")).toBeVisible();
    for (const method of ["pausePublication", "publicationAdmin", "createEdition"]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("member editor renders the roster and the four member forms", async ({ page }) => {
    await page.goto(`/#/publication/${enc(FIXTURES.publication)}/members`);
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();
    await expect(page.getByTestId("member-row")).toHaveCount(4);
    for (const method of ["addMember", "setRole", "removeMember", "attestSelf"]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("commission proposal renders parties, milestones and the four proposal forms", async ({
    page,
  }) => {
    await page.goto(`/#/commission/${enc(FIXTURES.proposal)}`);
    await expect(
      page.getByRole("heading", { name: "proposal:kindling:water" }),
    ).toBeVisible();
    await expect(page.getByTestId("proposal-status")).toHaveAttribute(
      "data-status",
      "accepted",
    );
    await expect(page.getByText("1,000 minor units")).toBeVisible();
    await expect(page.getByText("2 milestone(s)")).toBeVisible();
    for (const method of [
      "acceptProposal",
      "fundProposal",
      "cancelProposal",
      "attachCover",
    ]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("escrow renders accounting, milestones and the seven escrow forms", async ({
    page,
  }) => {
    await page.goto(`/#/escrow/${enc(FIXTURES.escrow)}`);
    await expect(
      page.getByRole("heading", { name: "proposal:kindling:water" }),
    ).toBeVisible();
    await expect(page.getByTestId("escrow-status")).toHaveAttribute(
      "data-status",
      "active",
    );
    await expect(page.locator("dt", { hasText: "Paid writer" })).toBeVisible();
    await expect(page.locator("dt", { hasText: "Remaining" })).toBeVisible();
    for (const method of [
      "submitMilestone",
      "releaseMilestone",
      "cancelEscrow",
      "disputeEscrow",
      "expireEscrow",
      "resolveDispute",
      "arbitrateEscrow",
    ]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("article renders provenance, corrections and the seven article forms", async ({
    page,
  }) => {
    await page.goto(`/#/article/${enc(FIXTURES.article)}`);
    await expect(
      page.getByRole("heading", { name: "article:kindling:1" }),
    ).toBeVisible();
    await expect(page.getByTestId("article-status")).toHaveAttribute(
      "data-status",
      "published",
    );
    await expect(page.getByText("cc-by-4.0 · open")).toBeVisible();
    await expect(page.locator("dt", { hasText: "Fact-check" })).toBeVisible();
    await expect(page.locator("dt", { hasText: "K-Asset gate" })).toBeVisible();
    await expect(page.getByText("Optional knowledge links")).toBeVisible();
    for (const method of [
      "submitArticle",
      "attachKnowledge",
      "attestArticle",
      "approveArticle",
      "publishArticle",
      "correctArticle",
      "retractArticle",
    ]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("edition renders the manifest and the create/append/seal forms", async ({ page }) => {
    await page.goto(`/#/edition/${enc(FIXTURES.edition)}`);
    await expect(
      page.getByRole("heading", { name: "Issue 1 · edition:kindling:1" }),
    ).toBeVisible();
    await expect(page.getByTestId("edition-status")).toHaveAttribute(
      "data-status",
      "sealed",
    );
    await expect(page.getByText("1 article(s)")).toBeVisible();
    for (const method of ["createEdition", "appendEditionArticle", "sealEdition"]) {
      await expect(page.getByTestId(`form-${method}`)).toBeVisible();
    }
  });

  test("coordination renders the provenance record and form", async ({ page }) => {
    await page.goto(`/#/coordination/${enc(FIXTURES.coordination)}`);
    await expect(
      page.getByRole("heading", { name: "coord:kindling:water-room" }),
    ).toBeVisible();
    await expect(page.getByTestId("coordination-status")).toHaveAttribute(
      "data-status",
      "recorded",
    );
    await expect(
      page.getByText("This is a provenance anchor for a quantum-os room outcome"),
    ).toBeVisible();
    await expect(page.getByText("Room and poll")).toBeVisible();
    await expect(page.getByTestId("form-recordCoordination")).toBeVisible();
  });

  test("keystore is locked and read-only in fixture mode", async ({ page }) => {
    await page.goto("/#/keystore");
    await expect(
      page.getByRole("heading", { name: "Keystore", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("Fixture mode. Switch to live in Network settings to create or unlock a wallet."),
    ).toBeVisible();
    await expect(page.getByTestId("session-status")).toHaveText("locked");
    await expect(page.getByTestId("session-address")).toHaveText("—");
    await expect(page.getByTestId("form-keystoreCreate").getByRole("button", { name: "Create" })).toBeDisabled();
    await expect(page.getByTestId("form-keystoreUnlock").getByRole("button", { name: "Unlock" })).toBeDisabled();
    await expect(page.getByTestId("form-importKeystore").getByRole("button", { name: "Import and unlock" })).toBeDisabled();
    await expect(page.getByTestId("form-exportKeystore")).toHaveCount(0);
    await expect(page.getByText("No encrypted documents saved locally.")).toBeVisible();
  });

  test("network shows fixture status and disables the faucet", async ({ page }) => {
    await page.goto("/#/network");
    await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
    await expect(page.getByLabel("Client mode")).toHaveValue("fixture");
    await expect(page.getByTestId("node-endpoint")).toHaveText("http://localhost:50403");
    await expect(page.getByTestId("node-height")).toHaveText("2050");
    await expect(page.getByTestId("node-accepts")).toHaveText("yes");
    await expect(page.getByRole("button", { name: "Request 30 REV" })).toBeDisabled();
    await expect(page.getByTestId("network-catalogue-item")).toHaveCount(0);
  });

  test("deploy history is empty in fixture mode", async ({ page }) => {
    await page.goto("/#/deploy");
    await expect(
      page.getByRole("heading", { name: "Deploy result and history" }),
    ).toBeVisible();
    await expect(page.getByText("No deploy attempts in this browser.")).toBeVisible();
    await expect(page.getByText("Fixture mode does not submit deploys.")).toBeVisible();
  });

  test("unknown entities and routes are refused without inventing data", async ({ page }) => {
    await page.goto(`/#/article/${enc("rho:id:unknown")}`);
    await expect(page.getByText("Refused: unknown article")).toBeVisible();

    await page.goto("/#/no-such-route");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the catalogue" })).toBeVisible();
  });
});
