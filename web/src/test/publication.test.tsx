import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ApiProvider } from "../lib/api-context";
import { FixtureApi, FIXTURE_ARTICLE_URI, FIXTURE_PUBLICATION_URI } from "../lib/fixture-api";
import { SessionProvider } from "../lib/session";
import { SettingsProvider, defaultSettings } from "../lib/settings";
import { AppRoutes } from "../routes";

function renderAt(path: string) {
  return render(
    <SettingsProvider initial={{ ...defaultSettings(), mode: "fixture" }}>
      <SessionProvider bridge={null}>
        <ApiProvider api={new FixtureApi()}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </ApiProvider>
      </SessionProvider>
    </SettingsProvider>,
  );
}

describe("Publication screen", () => {
  it("renders the charter, roster and the fixture banner", async () => {
    renderAt(`/publication/${encodeURIComponent(FIXTURE_PUBLICATION_URI)}`);
    expect(await screen.findByText("pub:kindling")).toBeInTheDocument();
    expect(screen.getAllByText(/Fixture mode/).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Fact-checker/)).toBeInTheDocument();
    expect(await screen.findByText(/platform PrintAdmin fallback/)).toBeInTheDocument();
  });

  it("renders a typed pause form and disables it in fixture mode", async () => {
    renderAt(`/publication/${encodeURIComponent(FIXTURE_PUBLICATION_URI)}`);
    expect(await screen.findByText("Pause or resume")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Fixture mode: this form is typed/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});

describe("Article screen", () => {
  it("shows the optional r-gen links", async () => {
    renderAt(`/article/${encodeURIComponent(FIXTURE_ARTICLE_URI)}`);
    expect(await screen.findByText(/Optional knowledge links/)).toBeInTheDocument();
    expect((await screen.findAllByText(/K-Asset gate/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/K-Asset/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/correction/).length).toBeGreaterThan(0);
  });
});
