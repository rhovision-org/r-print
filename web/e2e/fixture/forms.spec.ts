import { test, expect } from "../support/fixture-test";
import {
  COVERED_METHODS,
  FORM_INSTANCE_COUNT,
  FORM_ROUTES,
  WRITE_METHODS,
  expectedLabels,
  isKeystore,
  submitLabel,
} from "../support/forms";
import { field, form } from "../support/ui";

const FIXTURE_NOTE =
  "Fixture mode: this form is typed; switch to live mode to submit.";
const KEYSTORE_NOTE =
  "Fixture mode. Switch to live in Network settings to create or unlock a wallet.";

test("covers every write method with a fixture form", () => {
  expect(WRITE_METHODS).toHaveLength(34);
  expect(FORM_INSTANCE_COUNT).toBe(35);
  expect(COVERED_METHODS.size).toBe(WRITE_METHODS.length);
  for (const method of WRITE_METHODS) {
    expect(COVERED_METHODS.has(method), `${method} has no browser form`).toBe(true);
  }
});

for (const route of FORM_ROUTES) {
  test(`renders every write form at ${route.path}`, async ({ page }) => {
    await page.goto(`/#${route.path}`);
    await expect(page.getByRole("status")).toContainText("Fixture mode");

    for (const method of route.methods) {
      const panel = form(page, method);
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute("data-method", method);

      for (const label of expectedLabels(method)) {
        await expect(field(panel, label)).toBeVisible();
      }

      const submit = panel.getByRole("button", {
        name: submitLabel(method),
        exact: true,
      });
      await expect(submit).toBeVisible();
      await expect(submit).toBeDisabled();

      if (isKeystore(method)) {
        await expect(page.getByText(KEYSTORE_NOTE)).toBeVisible();
        continue;
      }

      await expect(panel.getByText(FIXTURE_NOTE)).toBeVisible();
      const controls = panel.locator("input, select, textarea");
      const count = await controls.count();
      for (let index = 0; index < count; index += 1) {
        await expect(controls.nth(index)).toBeDisabled();
      }
    }
  });
}
