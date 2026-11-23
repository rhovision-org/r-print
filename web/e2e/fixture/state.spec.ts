import { test, expect } from "../support/fixture-test";

test.describe("fixture state", () => {
  test("network settings persist across a reload", async ({ page }) => {
    await page.goto("/#/network");
    await page.getByLabel("Node URL", { exact: true }).fill("http://127.0.0.1:9999");
    await page.getByLabel("Root URI", { exact: true }).fill("rho:id:e2e-root");
    await page.getByRole("button", { name: "Save settings" }).click();

    await page.reload();
    await expect(page.getByLabel("Node URL", { exact: true })).toHaveValue(
      "http://127.0.0.1:9999",
    );
    await expect(page.getByLabel("Root URI", { exact: true })).toHaveValue(
      "rho:id:e2e-root",
    );
  });

  test("a deployment manifest supplies the root URI", async ({ page }) => {
    await page.goto("/#/network");
    await page
      .getByTestId("manifest-input")
      .fill(JSON.stringify({ root_uri: "rho:id:e2e-manifest" }));
    await page.getByRole("button", { name: "Use root_uri" }).click();
    await expect(page.getByLabel("Root URI", { exact: true })).toHaveValue(
      "rho:id:e2e-manifest",
    );

    await page.getByRole("button", { name: "Save settings" }).click();
    await page.reload();
    await expect(page.getByLabel("Root URI", { exact: true })).toHaveValue(
      "rho:id:e2e-manifest",
    );
  });

  test("a local catalogue link persists and can be removed", async ({ page }) => {
    await page.goto("/#/network");
    await page.getByLabel("Title", { exact: true }).fill("E2E link");
    await page.getByLabel("URI", { exact: true }).fill("rho:id:e2e-catalogue");
    await page
      .getByRole("combobox", { name: "Kind", exact: true })
      .selectOption("publication");
    await page.getByRole("button", { name: "Add link" }).click();

    const item = page.getByTestId("network-catalogue-item");
    await expect(item).toHaveCount(1);
    await expect(item).toHaveAttribute("data-uri", "rho:id:e2e-catalogue");

    await page.reload();
    await expect(page.getByTestId("network-catalogue-item")).toHaveCount(1);

    await page
      .getByTestId("network-catalogue-item")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByTestId("network-catalogue-item")).toHaveCount(0);
  });

  test("fixture mode keeps its own catalogue whatever the local list says", async ({
    page,
  }) => {
    await page.goto("/#/network");
    await page.getByLabel("Title", { exact: true }).fill("Local only");
    await page.getByLabel("URI", { exact: true }).fill("rho:id:local-only");
    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByTestId("catalogue-entry")).toHaveCount(4);
    await expect(page.getByText("Local only")).toHaveCount(0);
  });

  test("navigation reaches every screen", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("link", { name: "Network" }).click();
    await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
    await page.getByRole("link", { name: "Keystore" }).click();
    await expect(
      page.getByRole("heading", { name: "Keystore", level: 1 }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Deploy" }).click();
    await expect(
      page.getByRole("heading", { name: "Deploy result and history" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(
      page.getByRole("heading", { name: "A publication is an organisation." }),
    ).toBeVisible();
  });
});
