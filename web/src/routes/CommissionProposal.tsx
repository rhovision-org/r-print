import { Link, useParams } from "react-router-dom";
import { FormFor } from "../components/forms";
import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { MilestoneTimeline } from "../components/MilestoneTimeline";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { formatFee, formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function CommissionProposal() {
  const { uri = "" } = useParams();
  const api = useApi();
  const proposal = useAsync(() => api.commissionProposalInfo(uri), `${uri}:proposal`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / commission proposal
      </p>
      <AsyncBlock state={proposal}>
        {(value) => (
          <>
            <header className="page-header">
              <div>
                <h1>{value.proposalId}</h1>
                <p className="muted">
                  <span className="tag">{statusLabel(value.status)}</span> {formatFee(value.total)} ·{" "}
                  {value.milestones.length} milestone(s)
                </p>
              </div>
              {value.escrowUri ? (
                <Link to={`/escrow/${encodeURIComponent(value.escrowUri)}`}>Open escrow</Link>
              ) : null}
            </header>

            <section className="grid">
              <div className="panel">
                <h2>Parties</h2>
                <dl>
                  <dt>Writer</dt>
                  <dd>
                    <Hash value={value.writerId} /> <Hash value={value.writerDid} />
                  </dd>
                  <dt>Accepted by</dt>
                  <dd>
                    {value.editorId ? <Hash value={value.editorId} /> : "not accepted"}
                  </dd>
                  <dt>Brief</dt>
                  <dd>
                    <Hash value={value.briefHash} />
                  </dd>
                  <dt>Created</dt>
                  <dd>{formatHeight(value.createdAtHeight)}</dd>
                </dl>
              </div>
              <div className="panel">
                <h2>Cover and deadlines</h2>
                <dl>
                  <dt>r-sure cover</dt>
                  <dd>
                    {value.coverUri ? (
                      <>
                        <Hash value={value.coverUri} />{" "}
                        <span className="tag">{value.coverStatus ?? "attached"}</span>
                      </>
                    ) : (
                      <span className="muted">
                        No policy. Baseline escrow only; cover becomes useful at scale.
                      </span>
                    )}
                  </dd>
                  <dt>Grace</dt>
                  <dd>{value.graceBlocks} blocks</dd>
                  <dt>Dispute window</dt>
                  <dd>{value.disputeWindowBlocks} blocks</dd>
                  <dt>Fact-check</dt>
                  <dd>{value.requireFactCheck ? "required" : "not required"}</dd>
                </dl>
              </div>
            </section>

            <section className="panel">
              <h2>Milestones</h2>
              <MilestoneTimeline milestones={value.milestones} />
            </section>

            <section className="grid">
              <FormFor method="acceptProposal" uri={uri} onDone={proposal.reload} />
              <FormFor method="fundProposal" uri={uri} onDone={proposal.reload} />
              <FormFor method="cancelProposal" uri={uri} onDone={proposal.reload} />
              <FormFor method="attachCover" uri={uri} onDone={proposal.reload} />
            </section>

            <SurfaceChecklist
              title="Surface on this screen"
              methods={[
                "commissionProposalInfo",
                "acceptProposal",
                "fundProposal",
                "cancelProposal",
                "attachCover",
              ]}
            />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
