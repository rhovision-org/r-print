import { Link, useParams } from "react-router-dom";
import { FormFor } from "../components/forms";
import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { MilestoneTimeline } from "../components/MilestoneTimeline";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { formatFee, formatHeight, statusLabel } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function CommissionEscrow() {
  const { uri = "" } = useParams();
  const api = useApi();
  const escrow = useAsync(() => api.escrowInfo(uri), `${uri}:escrow`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> / commission escrow
      </p>
      <AsyncBlock state={escrow}>
        {(value) => {
          const remaining = value.total - value.paidWriter - value.refundedFunder - value.fee;
          return (
            <>
              <header className="page-header">
                <div>
                  <h1>{value.escrowId}</h1>
                  <p className="muted">
                    <span
                      className="tag"
                      data-testid="escrow-status"
                      data-status={value.status}
                    >
                      {statusLabel(value.status)}
                    </span>{" "}
                    {formatFee(value.total)} · hard deadline {formatHeight(value.hardDeadlineHeight)}
                  </p>
                </div>
                {value.coverUri ? (
                  <p>
                    cover <Hash value={value.coverUri} />
                  </p>
                ) : null}
              </header>

              <section className="grid">
                <div className="panel">
                  <h2>Accounting</h2>
                  <dl>
                    <dt>Total</dt>
                    <dd>{formatFee(value.total)}</dd>
                    <dt>Paid writer</dt>
                    <dd>{formatFee(value.paidWriter)}</dd>
                    <dt>Refunded funder</dt>
                    <dd>{formatFee(value.refundedFunder)}</dd>
                    <dt>Fee</dt>
                    <dd>{formatFee(value.fee)}</dd>
                    <dt>Remaining</dt>
                    <dd>{formatFee(remaining)}</dd>
                  </dl>
                </div>
                <div className="panel">
                  <h2>Authority</h2>
                  <dl>
                    <dt>Writer</dt>
                    <dd>
                      <Hash value={value.writerId} />
                    </dd>
                    <dt>Editor</dt>
                    <dd>
                      <Hash value={value.editorId} />
                    </dd>
                    <dt>Funder</dt>
                    <dd>
                      <Hash value={value.funderId} />
                    </dd>
                    <dt>Dispute</dt>
                    <dd>
                      {value.status === "disputed"
                        ? `${formatHeight(value.dispute.atHeight)} · ${value.dispute.reasonHash}`
                        : "none"}
                    </dd>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <h2>Milestones</h2>
                <MilestoneTimeline milestones={value.milestones} />
              </section>

              <section className="grid">
                <FormFor method="submitMilestone" uri={uri} onDone={escrow.reload} />
                <FormFor method="releaseMilestone" uri={uri} onDone={escrow.reload} />
                <FormFor method="cancelEscrow" uri={uri} onDone={escrow.reload} />
                <FormFor method="disputeEscrow" uri={uri} onDone={escrow.reload} />
                <FormFor method="expireEscrow" uri={uri} onDone={escrow.reload} />
                <FormFor method="resolveDispute" uri={uri} onDone={escrow.reload} />
              </section>

              <FormFor method="arbitrateEscrow" uri={uri} onDone={escrow.reload} />

              <SurfaceChecklist
                title="Surface on this screen"
                methods={[
                  "escrowInfo",
                  "submitMilestone",
                  "releaseMilestone",
                  "cancelEscrow",
                  "disputeEscrow",
                  "arbitrateEscrow",
                  "expireEscrow",
                  "resolveDispute",
                ]}
              />
            </>
          );
        }}
      </AsyncBlock>
    </div>
  );
}
