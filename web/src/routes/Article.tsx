import { Link, useParams } from "react-router-dom";
import { ActionPanel } from "../components/ActionPanel";
import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function Article() {
  const { uri = "" } = useParams();
  const api = useApi();
  const article = useAsync(() => api.articleInfo(uri), `${uri}:article`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / article
      </p>
      <AsyncBlock state={article}>
        {(value) => (
          <>
            <header className="page-header">
              <div>
                <h1>{value.articleId}</h1>
                <p className="muted">
                  <span className="tag">{statusLabel(value.status)}</span> {value.license} ·{" "}
                  {value.access}
                  {value.publishHeight ? ` · published ${formatHeight(value.publishHeight)}` : ""}
                </p>
              </div>
              <Link to={`/publication/${encodeURIComponent(value.publicationUri)}`}>
                Publication
              </Link>
            </header>

            <section className="grid">
              <div className="panel">
                <h2>Provenance</h2>
                <dl>
                  <dt>Content hash</dt>
                  <dd>
                    <Hash value={value.contentHash} />
                  </dd>
                  <dt>Bylines</dt>
                  <dd>
                    {value.authors.map((author) => (
                      <div key={author.memberId}>
                        <Hash value={author.memberId} /> <Hash value={author.did} />
                      </div>
                    ))}
                  </dd>
                  <dt>Fact-check</dt>
                  <dd>{value.requireFactCheck ? "required" : "not required"}</dd>
                  <dt>K-Asset gate</dt>
                  <dd>{value.requireKAsset ? "required" : "optional"}</dd>
                </dl>
              </div>

              <div className="panel">
                <h2>Optional knowledge links</h2>
                {value.kassetUri ? (
                  <dl>
                    <dt>K-Asset</dt>
                    <dd>
                      <Hash value={value.kassetUri} />
                    </dd>
                    <dt>Claim</dt>
                    <dd>
                      <Hash value={value.claimUri} />
                    </dd>
                    <dt>Provenance</dt>
                    <dd>
                      <Hash value={value.provenanceUri} />
                    </dd>
                    <dt>Credential</dt>
                    <dd>
                      <Hash value={value.credentialUri} />
                    </dd>
                    <dt>Attached</dt>
                    <dd>{formatHeight(value.knowledgeAtHeight)}</dd>
                  </dl>
                ) : (
                  <p className="muted">
                    No r-gen Claim/KAsset/Provenance attached. A content hash is enough to
                    publish; K-Assets strengthen credibility when a publication asks for them.
                  </p>
                )}
              </div>
            </section>

            <section className="grid">
              <div className="panel">
                <h2>Attestations</h2>
                {value.attestations.length === 0 ? (
                  <p className="muted">None.</p>
                ) : (
                  <ul>
                    {value.attestations.map((attestation) => (
                      <li key={attestation.id}>
                        <span className="tag">{attestation.kind}</span>{" "}
                        <Hash value={attestation.by} /> <Hash value={attestation.evidenceHash} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="panel">
                <h2>Corrections</h2>
                {value.corrections.length === 0 ? (
                  <p className="muted">None. Corrections append; they never rewrite.</p>
                ) : (
                  <ol>
                    {value.corrections.map((correction) => (
                      <li key={correction.id}>
                        <span className="tag">{correction.kind}</span>{" "}
                        <Hash value={correction.articleHash} /> by <Hash value={correction.by} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            <ActionPanel
              title="Article actions"
              description="Author submits; fact-checker attests; editor approves and publishes. Attaching knowledge is optional. Corrections and retractions append."
              actions={[
                {
                  label: "Submit draft",
                  method: "submitArticle",
                  description: "Author content hash",
                  run: (api) =>
                    api.submitArticle(uri, {
                      opId: "submit-op",
                      contentHash: value.contentHash,
                    }),
                },
                {
                  label: "Attach knowledge",
                  method: "attachKnowledge",
                  description: "r-gen links",
                  run: (api) =>
                    api.attachKnowledge(uri, {
                      opId: "know-op",
                      kassetUri: "rho:id:kasset",
                      claimUri: "rho:id:claim",
                      provenanceUri: "rho:id:provenance",
                      credentialUri: "",
                    }),
                },
                {
                  label: "Attest",
                  method: "attestArticle",
                  description: "Fact-check/legal/editorial",
                  run: (api) =>
                    api.attestArticle(uri, {
                      opId: "attest-op",
                      attestationId: "fact-1",
                      kind: "factcheck",
                      evidenceHash: "evidence:fact",
                    }),
                },
                {
                  label: "Approve",
                  method: "approveArticle",
                  description: "Editor or publisher",
                  run: (api) => api.approveArticle(uri, { opId: "approve-op" }),
                },
                {
                  label: "Publish",
                  method: "publishArticle",
                  description: "Freeze the content hash",
                  run: (api) => api.publishArticle(uri, { opId: "publish-op" }),
                },
                {
                  label: "Correct",
                  method: "correctArticle",
                  description: "Append a correction",
                  run: (api) =>
                    api.correctArticle(uri, {
                      opId: "correct-op",
                      correctionId: "corr",
                      kind: "correction",
                      bodyHash: "body",
                      reasonHash: "reason",
                    }),
                },
                {
                  label: "Retract",
                  method: "retractArticle",
                  description: "Append a retraction",
                  run: (api) => api.retractArticle(uri, { opId: "retract-op", reasonHash: "reason" }),
                },
              ]}
            />

            <SurfaceChecklist
              title="Surface on this screen"
              methods={[
                "articleInfo",
                "submitArticle",
                "attachKnowledge",
                "attestArticle",
                "approveArticle",
                "publishArticle",
                "correctArticle",
                "retractArticle",
              ]}
            />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
