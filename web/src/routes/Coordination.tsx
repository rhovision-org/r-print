import { Link, useParams } from "react-router-dom";
import { AsyncBlock } from "../components/AsyncBlock";
import { FormFor } from "../components/forms";
import { Hash } from "../components/Hash";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function Coordination() {
  const { uri = "" } = useParams();
  const api = useApi();
  const record = useAsync(() => api.coordinationInfo(uri), `${uri}:coordination`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / coordination record
      </p>
      <p className="muted">
        An editor or publisher records a quantum-os room/poll outcome. The record is
        provenance, not authority: it never writes the publication cell.
      </p>
      <AsyncBlock state={record}>
        {(value) => (
          <>
            <header className="page-header">
              <div>
                <h1>{value.coordinationId}</h1>
                <p className="muted">
                  <span
                    className="tag"
                    data-testid="coordination-status"
                    data-status={value.status}
                  >
                    {statusLabel(value.status)}
                  </span>{" "}
                  {value.subjectRef.kind} <Hash value={value.subjectRef.uri} />
                </p>
              </div>
            </header>

            <section className="grid">
              <div className="panel">
                <h2>Room and poll</h2>
                <dl>
                  <dt>Room</dt>
                  <dd>
                    <Hash value={value.roomIdHash} />
                  </dd>
                  <dt>Poll</dt>
                  <dd>
                    <Hash value={value.pollIdHash} />
                  </dd>
                  <dt>Outcome</dt>
                  <dd>
                    <Hash value={value.outcomeHash} />
                  </dd>
                </dl>
                <p className="muted">
                  This is a provenance anchor for a quantum-os room outcome, not an authority
                  source. Editorial authority stays with the publication roster.
                </p>
              </div>
              <div className="panel">
                <h2>Signers</h2>
                <ul>
                  {value.signers.map((signer) => (
                    <li key={signer}>
                      <Hash value={signer} />
                    </li>
                  ))}
                </ul>
                <h3>Signatures</h3>
                {value.signatures.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul>
                    {value.signatures.map((signature) => (
                      <li key={signature.by}>
                        <Hash value={signature.by} /> at {formatHeight(signature.atHeight)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <div className="panel">
              <h2>Record the outcome</h2>
              <p className="muted">
                {value.status === "recorded"
                  ? "The first outcome is terminal; a different poll or outcome is refused."
                  : "Each signer entry signs the canonical text for this record."}
              </p>
              <FormFor method="recordCoordination" uri={uri} onDone={record.reload} />
            </div>

            <SurfaceChecklist
              title="Surface on this screen"
              methods={["coordinationInfo", "recordCoordination"]}
            />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
