import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ApiProvider } from "../lib/api-context";
import { FixtureApi, FIXTURE_ARTICLE_URI, FIXTURE_PUBLICATION_URI } from "../lib/fixture-api";
import { AppRoutes } from "../routes";

function renderAt(path: string) {
  return render(
    <ApiProvider api={new FixtureApi()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ApiProvider>,
  );
}

describe("Publication screen", () => {
  it("renders the charter, roster and the sketch banner", async () => {
    renderAt(`/publication/${encodeURIComponent(FIXTURE_PUBLICATION_URI)}`);
    expect(await screen.findByText("pub:kindling")).toBeInTheDocument();
    expect(screen.getByText(/v0.1 sketch/)).toBeInTheDocument();
    expect(await screen.findByText(/Fact-checker/)).toBeInTheDocument();
    expect(await screen.findByText(/platform PrintAdmin fallback/)).toBeInTheDocument();
  });

  it("shows the documented not-implemented error for a write", async () => {
    renderAt(`/publication/${encodeURIComponent(FIXTURE_PUBLICATION_URI)}`);
    const button = await screen.findByRole("button", { name: /Pause publication/ });
    fireEvent.click(button);
    expect(
      await screen.findByText(/Not implemented in v0.1: pausePublication/),
    ).toBeInTheDocument();
  });
});

describe("Article screen", () => {
  it("shows the optional r-gen links", async () => {
    renderAt(`/article/${encodeURIComponent(FIXTURE_ARTICLE_URI)}`);
    expect(await screen.findByText(/Optional knowledge links/)).toBeInTheDocument();
    await screen.findByText(/K-Asset gate/);
    expect(screen.getAllByText(/K-Asset/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/correction/).length).toBeGreaterThan(0);
  });
});
