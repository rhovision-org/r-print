import { expect, type Locator, type Page } from "@playwright/test";

export function encodeUri(uri: string): string {
  return encodeURIComponent(uri);
}

/** Change the hash without a document load, preserving the in-memory WASM wallet. */
export async function goHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, hash);
}

export function form(page: Page, method: string): Locator {
  return page.getByTestId(`form-${method}`);
}

/**
 * A typed field by label. Selects are matched by their accessible name: an exact
 * `getByLabel` sees the option text inside the wrapping label, so it misses them.
 */
export function field(panel: Locator, label: string): Locator {
  return panel
    .getByLabel(label, { exact: true })
    .or(panel.getByRole("combobox", { name: label, exact: true }));
}

export function combobox(panel: Locator, label: string): Locator {
  return panel.getByRole("combobox", { name: label, exact: true });
}

export interface ReplyJson {
  ok: boolean;
  value?: unknown;
  reason?: string;
}

export async function readReply(locator: Locator): Promise<ReplyJson> {
  const text = await locator.textContent();
  return JSON.parse(text ?? "{}") as ReplyJson;
}

export async function clickSubmit(
  formLocator: Locator,
  label: string,
): Promise<void> {
  const submit = formLocator.getByRole("button", { name: label, exact: true });
  await expect(submit).toBeEnabled({ timeout: 60_000 });
  await submit.click();
}

/**
 * Click one form's submit and wait for its chain reply. A refusal is still a reply; the
 * caller decides whether ok:false is expected. Forms whose parent reloads on success
 * unmount before the reply can persist; use clickSubmit plus a state assertion there.
 */
export async function submitAndReply(
  formLocator: Locator,
  label: string,
  timeout = 300_000,
): Promise<ReplyJson> {
  await clickSubmit(formLocator, label);
  const reply = formLocator.getByTestId("form-reply");
  await expect(reply).toBeVisible({ timeout });
  return readReply(reply);
}
