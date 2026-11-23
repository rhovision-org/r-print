import { Link, useParams } from "react-router-dom";
import { FormFor } from "../components/forms";
import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function Edition() {
  const { uri = "" } = useParams();
  const api = useApi();
  const edition = useAsync(() => api.editionInfo(uri), `${uri}:edition`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / edition
      </p>
      <AsyncBlock state={edition}>
        {(value) => (
          <>
            <header className="page-header">
              <div>
                <h1>
                  Issue {value.number} · {value.editionId}
                </h1>
                <p className="muted">
                  <span
                    className="tag"
                    data-testid="edition-status"
                    data-status={value.status}
                  >
                    {statusLabel(value.status)}
                  </span>{" "}
                  {value.articles.length} article(s) · created{" "}
                  {formatHeight(value.createdAtHeight)}
                </p>
              </div>
              <Link to={`/publication/${encodeURIComponent(value.publicationUri)}`}>
                Publication
              </Link>
            </header>

            <section className="grid">
              <div className="panel">
                <h2>Manifest</h2>
                {value.articles.length === 0 ? (
                  <p className="muted">Empty draft. Append published articles in order.</p>
                ) : (
                  <ol>
                    {value.articles.map((entry) => (
                      <li key={entry.articleId}>
                        <Link to={`/article/${encodeURIComponent(entry.articleUri)}`}>
                          {entry.articleId}
                        </Link>{" "}
                        <Hash value={entry.contentHash} />
                        {entry.kassetUri ? (
                          <>
                            {" "}
                            <span className="tag">kasset</span> <Hash value={entry.kassetUri} />
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="panel">
                <h2>Seal</h2>
                <dl>
                  <dt>Manifest hash</dt>
                  <dd>
                    <Hash value={value.seal.manifestHash} />
                  </dd>
                  <dt>Editor</dt>
                  <dd>
                    <Hash value={value.seal.editorId} />
                  </dd>
                  <dt>Sealed</dt>
                  <dd>{formatHeight(value.seal.sealedAtHeight)}</dd>
                </dl>
                <p className="muted">
                  Sealing freezes the ordered manifest. A later retraction is recorded on the
                  article, not by rewriting the edition.
                </p>
              </div>
            </section>

            <section className="grid">
              <FormFor
                method="createEdition"
                onDone={edition.reload}
                defaults={{
                  publicationId: value.publicationId,
                  publicationUri: value.publicationUri,
                  number: value.number + 1,
                }}
              />
              <FormFor method="appendEditionArticle" uri={uri} onDone={edition.reload} />
            </section>
            <FormFor method="sealEdition" uri={uri} onDone={edition.reload} />

            <SurfaceChecklist
              title="Surface on this screen"
              methods={["editionInfo", "createEdition", "appendEditionArticle", "sealEdition"]}
            />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
