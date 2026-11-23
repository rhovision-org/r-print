import { Link, useParams } from "react-router-dom";
import { FormFor } from "../components/forms";
import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { MemberTable } from "../components/MemberTable";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { bpsToPercent, formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function Publication() {
  const { uri = "" } = useParams();
  const api = useApi();
  const info = useAsync(() => api.publicationInfo(uri), `${uri}:info`);
  const charter = useAsync(() => api.publicationCharter(uri), `${uri}:charter`);
  const members = useAsync(() => api.publicationMembers(uri), `${uri}:members`);
  const arbitration = useAsync(
    () => api.publicationArbitration(uri),
    `${uri}:arbitration`,
  );

  function reloadAll() {
    info.reload();
    charter.reload();
    members.reload();
    arbitration.reload();
  }

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / publication
      </p>
      <AsyncBlock state={info}>
        {(publication) => (
          <>
            <header className="page-header">
              <div>
                <h1>{publication.publicationId}</h1>
                <p className="muted">
                  <span
                    className="tag"
                    data-testid="publication-status"
                    data-status={publication.status}
                  >
                    {statusLabel(publication.status)}
                  </span>{" "}
                  charter{" "}
                  <Hash value={publication.charterHash} /> · founded{" "}
                  {formatHeight(publication.charter.foundedAtHeight)}
                </p>
              </div>
              <Link to={`/publication/${encodeURIComponent(uri)}/members`}>Edit roster</Link>
            </header>

            <section className="grid">
              <div className="panel">
                <h2>Charter</h2>
                <AsyncBlock state={charter}>
                  {(value) => (
                    <dl>
                      <dt>Masthead</dt>
                      <dd>
                        <Hash value={value.mastheadHash} />
                      </dd>
                      <dt>Treasury</dt>
                      <dd>
                        <Hash value={value.treasuryAccountId} />
                      </dd>
                      <dt>Admins</dt>
                      <dd>
                        {value.admins.length} key(s), threshold {value.threshold}
                        {value.admins.length === 1 ? " (solo)" : ""}
                      </dd>
                      <dt>Revenue split</dt>
                      <dd>
                        {value.revenueSplit.length === 0
                          ? "—"
                          : value.revenueSplit.map((split) => (
                              <div key={split.memberId}>
                                <Hash value={split.memberId} /> {bpsToPercent(split.bps)}
                              </div>
                            ))}
                      </dd>
                    </dl>
                  )}
                </AsyncBlock>
              </div>

              <div className="panel">
                <h2>Cover and arbitration</h2>
                <dl>
                  <dt>Cover policy</dt>
                  <dd>
                    {publication.coverUri ? (
                      <>
                        <Hash value={publication.coverUri} />{" "}
                        <span className="tag">{publication.coverStatus ?? "attached"}</span>
                      </>
                    ) : (
                      <span className="muted">
                        No r-sure policy attached. Escrow is the baseline rail.
                      </span>
                    )}
                  </dd>
                  <dt>Publication quorum</dt>
                  <dd>
                    {publication.admins.length >= 2
                      ? `publication ${publication.threshold}-of-${publication.admins.length}`
                      : "platform PrintAdmin fallback (solo publication)"}
                  </dd>
                  <dt>Effective arbitration</dt>
                  <dd>
                    <AsyncBlock state={arbitration}>
                      {(value) => (
                        <>
                          {value.kind} · {value.threshold}-of-{value.keys.length}
                        </>
                      )}
                    </AsyncBlock>
                  </dd>
                </dl>
              </div>
            </section>

            <section className="panel">
              <h2>Roster</h2>
              <AsyncBlock state={members}>{(value) => <MemberTable members={value} />}</AsyncBlock>
            </section>

            <section className="grid">
              <FormFor method="pausePublication" uri={uri} onDone={reloadAll} />
              <FormFor method="publicationAdmin" uri={uri} onDone={reloadAll} />
              <FormFor
                method="createEdition"
                defaults={{
                  publicationId: publication.publicationId,
                  publicationUri: uri,
                  number: 1,
                }}
              />
            </section>

            <SurfaceChecklist
              title="Surface on this screen"
              methods={[
                "publicationInfo",
                "publicationCharter",
                "publicationMembers",
                "publicationArbitration",
                "pausePublication",
                "publicationAdmin",
                "createEdition",
              ]}
            />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
