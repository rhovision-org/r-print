import type { Milestone } from "../lib/types";
import { formatFee, formatHeight, statusLabel } from "../lib/format";
import { Hash } from "./Hash";

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="timeline">
      {milestones.map((milestone) => (
        <li key={milestone.id} className={`milestone ${milestone.status}`}>
          <div>
            <strong>{milestone.id}</strong> <span className="tag">{milestone.kind}</span>
          </div>
          <div>{formatFee(milestone.amount)}</div>
          <div className="muted">
            deadline {formatHeight(milestone.deadlineHeight)} · {statusLabel(milestone.status)}
          </div>
          {milestone.evidenceHash ? (
            <div>
              evidence <Hash value={milestone.evidenceHash} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
