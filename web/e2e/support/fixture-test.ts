import { test as base, expect } from "@playwright/test";

type Fixtures = {
  blockedRequests: string[];
};

/**
 * Fixture mode must not touch a node or the generated WASM package. The auto fixture
 * aborts both paths and fails the test if either was requested.
 */
export const test = base.extend<Fixtures>({
  blockedRequests: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.route("**/api/**", async (route) => {
        blocked.push(route.request().url());
        await route.abort();
      });
      await context.route("**/wasm/**", async (route) => {
        blocked.push(route.request().url());
        await route.abort();
      });
      await use(blocked);
      expect(
        blocked,
        `fixture mode must not call /api or /wasm: ${blocked.join(", ")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
