import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  API_METHODS,
  READ_METHODS,
  WRITE_METHODS,
  type ApiMethod,
  type WriteMethod,
} from "../lib/api";
import { ApiProvider } from "../lib/api-context";
import {
  FIXTURE_ARTICLE_URI,
  FIXTURE_COORDINATION_URI,
  FIXTURE_EDITION_URI,
  FIXTURE_ESCROW_URI,
  FIXTURE_PROPOSAL_URI,
  FIXTURE_PUBLICATION_URI,
  FixtureApi,
} from "../lib/fixture-api";
import { SessionProvider } from "../lib/session";
import { SettingsProvider, defaultSettings } from "../lib/settings";
import {
  BESPOKE_METHODS,
  FORM_IMPLEMENTATIONS,
  FormFor,
} from "../components/forms";
import { SIMPLE_FORMS } from "../components/forms/specs";

function uriFor(method: ApiMethod): string {
  if (method.includes("Publication") || method.includes("Member") || method === "setRole" || method === "attestSelf") {
    return FIXTURE_PUBLICATION_URI;
  }
  if (method.includes("Escrow") || method.includes("Milestone") || method === "resolveDispute") {
    return FIXTURE_ESCROW_URI;
  }
  if (method.includes("Proposal") || method === "attachCover" || method === "cancelProposal") {
    return FIXTURE_PROPOSAL_URI;
  }
  if (method.includes("Article") || method === "attachKnowledge") {
    return FIXTURE_ARTICLE_URI;
  }
  if (method.includes("Edition") || method === "sealEdition" || method === "appendEditionArticle") {
    return FIXTURE_EDITION_URI;
  }
  if (method.includes("Coordination")) {
    return FIXTURE_COORDINATION_URI;
  }
  return FIXTURE_PUBLICATION_URI;
}

function renderForm(method: ApiMethod) {
  return render(
    <SettingsProvider initial={{ ...defaultSettings(), mode: "fixture" }}>
      <SessionProvider bridge={null}>
        <ApiProvider api={new FixtureApi()}>
          <FormFor method={method as WriteMethod} uri={uriFor(method)} />
        </ApiProvider>
      </SessionProvider>
    </SettingsProvider>,
  );
}

describe("form coverage", () => {
  it("covers every write method exactly once", () => {
    expect(new Set(FORM_IMPLEMENTATIONS).size).toBe(FORM_IMPLEMENTATIONS.length);
    for (const method of WRITE_METHODS) {
      expect(FORM_IMPLEMENTATIONS).toContain(method);
    }
    expect(FORM_IMPLEMENTATIONS).toHaveLength(WRITE_METHODS.length);
  });

  it("splits the API into reads and writes without overlap", () => {
    const union = new Set<ApiMethod>([...READ_METHODS, ...WRITE_METHODS]);
    expect(union.size).toBe(API_METHODS.length);
    for (const method of API_METHODS) expect(union.has(method)).toBe(true);
    for (const method of READ_METHODS) expect(WRITE_METHODS).not.toContain(method);
  });

  it("declares bespoke forms for the nested and multisig writes", () => {
    for (const method of [
      "createPublication",
      "proposeCommission",
      "createArticle",
      "sealEdition",
      "publicationAdmin",
      "arbitrateEscrow",
      "keystoreCreate",
      "keystoreUnlock",
    ] as const) {
      expect(BESPOKE_METHODS).toContain(method);
    }
  });

  it("keeps every simple spec keyed by its method", () => {
    for (const [key, spec] of Object.entries(SIMPLE_FORMS)) {
      expect(spec.method).toBe(key);
      expect(typeof spec.submit).toBe("function");
    }
  });

  it.each(WRITE_METHODS.filter((method) => !method.startsWith("keystore")))(
    "renders a typed form for %s",
    (method) => {
      const view = renderForm(method);
      expect(view.container.textContent).toBeTruthy();
    },
  );
});
