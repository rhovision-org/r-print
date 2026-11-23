import { describe, expect, it } from "vitest";
import { API_METHODS } from "../lib/api";
import { SURFACE, surfaceFor } from "../lib/surface";
import { ROUTE_TABLE } from "../routes";

describe("surface coverage", () => {
  it("documents every API method exactly once", () => {
    const documented = SURFACE.map((entry) => entry.method);
    expect(new Set(documented).size).toBe(documented.length);
    for (const method of API_METHODS) {
      expect(surfaceFor(method), `missing surface entry for ${method}`).toBeDefined();
    }
  });

  it("does not document a method that is not on the API", () => {
    const known = new Set<string>(API_METHODS);
    for (const entry of SURFACE) {
      expect(known.has(entry.method), `unknown method ${entry.method}`).toBe(true);
    }
  });

  it("routes every entity surface", () => {
    const entities = ROUTE_TABLE.map((route) => route.entity);
    for (const entity of [
      "home",
      "publication",
      "members",
      "commission-proposal",
      "commission-escrow",
      "article",
      "edition",
      "coordination",
      "keystore",
      "network",
      "deploy",
      "not-found",
    ]) {
      expect(entities).toContain(entity);
    }
  });

  it("gives every route entry a path and element", () => {
    for (const route of ROUTE_TABLE) {
      expect(route.path === "*" || route.path.startsWith("/")).toBe(true);
      expect(route.element).toBeTruthy();
    }
  });
});
