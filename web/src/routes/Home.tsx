import { Link } from "react-router-dom";
import { ActionPanel } from "../components/ActionPanel";
import { fixtureCatalogue } from "../lib/fixture-api";

export function Home() {
  const catalogue = fixtureCatalogue();
  return (
    <div>
      <section className="hero">
        <h1>A publication is an organisation.</h1>
        <p>
          r-print models the masthead, the commissioned work, the article and the edition as
          separate primitives. This client is a read-only sketch: every write below is typed,
          documented and deliberately unimplemented.
        </p>
      </section>

      <section className="panel">
        <h2>Catalogue</h2>
        <p className="muted">
          No indexer: this is a local catalogue of links, exactly like a publication sharing
          its own front page.
        </p>
        <ul className="catalogue">
          {catalogue.map((entry) => (
            <li key={entry.uri}>
              <span className="tag">{entry.kind}</span>
              <Link to={routeFor(entry.kind, entry.uri)}>{entry.title}</Link>
              <code>{entry.uri}</code>
            </li>
          ))}
        </ul>
      </section>

      <ActionPanel
        title="Found a publication"
        description="PublicationFactory('create') with a charter, admins and founding members."
        actions={[
          {
            label: "Create publication",
            method: "createPublication",
            description: "Charter, admins, roster",
            run: (api) =>
              api.createPublication({
                publicationId: "pub:new",
                opId: "create-op",
                charter: {
                  nameHash: "name:new",
                  mastheadHash: "masthead:new",
                  taglineHash: "",
                  foundedAtHeight: 0,
                  treasuryAccountId: "",
                  assetId: "REV",
                  revenueSplit: [],
                  admins: [],
                  threshold: 1,
                  governance: {
                    maxMembers: 32,
                    requireFactCheck: false,
                    requireKAsset: false,
                    disputeWindowBlocks: 20,
                    commissionGraceBlocks: 10,
                  },
                },
                members: [],
              }),
          },
        ]}
      />

      <ActionPanel
        title="Commission a story or an investigation"
        description="CommissionFactory('propose') records the writer, brief, total and milestones; an editor accepts and a funder creates the escrow."
        actions={[
          {
            label: "Propose commission",
            method: "proposeCommission",
            description: "Writer, brief, milestones",
            run: (api) =>
              api.proposeCommission({
                proposalId: "proposal:new",
                opId: "propose-op",
                publicationId: "pub:new",
                publicationUri: "rho:id:new-publication",
                writerDid: "did:byoid:writer",
                titleHash: "title:new",
                briefHash: "brief:new",
                total: 1000,
                milestones: [
                  { id: "m1", kind: "stipend", amount: 400, deadlineHeight: 100 },
                  { id: "m2", kind: "final", amount: 600, deadlineHeight: 200 },
                ],
                graceBlocks: 10,
                disputeWindowBlocks: 20,
                requireFactCheck: true,
              }),
          },
        ]}
      />

      <ActionPanel
        title="Register an article"
        description="ArticleFactory('create') binds the article to the canonical publication and its active author roster."
        actions={[
          {
            label: "Create article",
            method: "createArticle",
            description: "Author, content hash, license",
            run: (api) =>
              api.createArticle({
                articleId: "article:new",
                opId: "article-op",
                publicationId: "pub:new",
                publicationUri: "rho:id:new-publication",
                authors: [
                  { memberId: "1111member", did: "did:byoid:writer", bylineHash: "byline" },
                ],
                contentHash: "content:new",
                license: "cc-by-4.0",
                customLicenseHash: "",
                access: "open",
                sectionHash: "section:news",
                requireFactCheck: true,
                requireKAsset: false,
              }),
          },
        ]}
      />
    </div>
  );
}

function routeFor(kind: string, uri: string): string {
  switch (kind) {
    case "publication":
      return `/publication/${encodeURIComponent(uri)}`;
    case "article":
      return `/article/${encodeURIComponent(uri)}`;
    case "edition":
      return `/edition/${encodeURIComponent(uri)}`;
    case "commission":
      return `/commission/${encodeURIComponent(uri)}`;
    default:
      return "/";
  }
}
