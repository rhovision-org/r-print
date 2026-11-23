import { describe, expect, it } from "vitest";
import { API_METHODS } from "../lib/api";
import { NotImplementedError, StubApi } from "../lib/stub-api";

describe("StubApi", () => {
  const stub = new StubApi() as unknown as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;

  it.each(API_METHODS)("documents %s as not implemented", async (method) => {
    await expect(stub[method]?.()).rejects.toBeInstanceOf(NotImplementedError);
  });
});
