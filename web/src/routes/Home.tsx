import { Link } from "react-router-dom";
import { FormFor } from "../components/forms";
import { fixtureCatalogue } from "../lib/fixture-api";
import { useSettings } from "../lib/settings";

export function Home() {
  const { settings } = useSettings();
  const catalogue =
    settings.mode === "live" ? settings.catalogue : fixtureCatalogue();

  return (
    <div>
      <section className="hero">
        <h1>A publication is an organisation.</h1>
        <p>
          r-print models the masthead, the commissioned work, the article and the edition as
          separate primitives.{" "}
          {settings.mode === "live"
            ? "This client is live against the configured devnet: reads use explore-deploy, writes are signed and require finality."
            : "This is fixture mode; the typed forms below are the live client surface. Switch to live in Network settings."}
        </p>
      </section>

      <section className="panel">
        <h2>Catalogue</h2>
        <p className="muted">
          No indexer: this is a local catalogue of links, exactly like a publication sharing
          its own front page.
        </p>
        {catalogue.length === 0 ? (
          <p className="muted">
            No entries yet. Create a publication below, or add links in Network settings.
          </p>
        ) : (
          <ul className="catalogue">
            {catalogue.map((entry) => (
              <li key={entry.uri}>
                <span className="tag">{entry.kind}</span>
                <Link to={routeFor(entry.kind, entry.uri)}>{entry.title}</Link>
                <code>{entry.uri}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid">
        <FormFor method="createPublication" />
        <FormFor method="proposeCommission" />
      </section>
      <FormFor method="createArticle" />
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
