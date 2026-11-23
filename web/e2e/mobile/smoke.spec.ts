import { test, expect } from "../support/fixture-test";
import { FIXTURES } from "../support/forms";

const enc = encodeURIComponent;

test("mobile fixture smoke covers home, publication and network", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByRole("status")).toContainText("Fixture mode");
  await expect(
    page.getByRole("heading", { name: "A publication is an organisation." }),
  ).toBeVisible();
  await expect(page.getByTestId("form-createPublication")).toBeVisible();

  await page.goto(`/#/publication/${enc(FIXTURES.publication)}`);
  await expect(page.getByRole("heading", { name: "pub:kindling" })).toBeVisible();
  await expect(page.getByTestId("form-pausePublication")).toBeVisible();
  await expect(page.getByTestId("publication-status")).toHaveAttribute(
    "data-status",
    "active",
  );

  await page.goto("/#/network");
  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
  await expect(page.getByTestId("network-status")).toBeVisible();
  await expect(page.getByTestId("node-height")).toHaveText("2050");
});
