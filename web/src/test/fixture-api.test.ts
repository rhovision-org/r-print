import { describe, expect, it } from "vitest";
import { FixtureApi, FIXTURE_ARTICLE_URI, FIXTURE_EDITION_URI, FIXTURE_PUBLICATION_URI } from "../lib/fixture-api";

const api = new FixtureApi();

describe("FixtureApi reads", () => {
  it("serves the publication, charter and roster", async () => {
    const info = await api.publicationInfo(FIXTURE_PUBLICATION_URI);
    expect(info.ok).toBe(true);
    if (!info.ok) return;
    expect(info.value.publicationId).toBe("pub:kindling");
    expect(info.value.coverUri).toContain("policy");

    const charter = await api.publicationCharter(FIXTURE_PUBLICATION_URI);
    expect(charter.ok && charter.value.governance.requireFactCheck).toBe(true);

    const members = await api.publicationMembers(FIXTURE_PUBLICATION_URI);
    expect(members.ok && Object.keys(members.value).length).toBe(4);
  });

  it("serves an article with optional knowledge links", async () => {
    const article = await api.articleInfo(FIXTURE_ARTICLE_URI);
    expect(article.ok).toBe(true);
    if (!article.ok) return;
    expect(article.value.kassetUri).toContain("kasset");
    expect(article.value.corrections).toHaveLength(1);
    expect(article.value.status).toBe("published");
  });

  it("serves the sealed edition manifest", async () => {
    const edition = await api.editionInfo(FIXTURE_EDITION_URI);
    expect(edition.ok && edition.value.status).toBe("sealed");
    if (edition.ok) expect(edition.value.articles).toHaveLength(1);
  });

  it("refuses unknown entities and leaves writes to the stub", async () => {
    const unknown = await api.publicationInfo("rho:id:nope");
    expect(unknown.ok).toBe(false);
    await expect(api.createPublication({} as never)).rejects.toThrow(
      "createPublication is not implemented",
    );
  });
});
