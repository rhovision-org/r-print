import type { Member } from "../lib/types";
import { formatHeight, roleLabel } from "../lib/format";
import { Hash } from "./Hash";

export function MemberTable({ members }: { members: Record<string, Member> }) {
  const rows = Object.entries(members).sort(([, a], [, b]) => a.role.localeCompare(b.role));
  return (
    <table>
      <thead>
        <tr>
          <th>Member (REV)</th>
          <th>Role</th>
          <th>DID / anchor</th>
          <th>Since</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([id, member]) => (
          <tr
            key={id}
            className={member.status === "removed" ? "removed" : undefined}
            data-testid="member-row"
            data-member-id={id}
            data-role={member.role}
            data-status={member.status}
          >
            <td>
              <Hash value={id} />
            </td>
            <td>{roleLabel(member.role)}</td>
            <td>
              <Hash value={member.did} />
            </td>
            <td>{formatHeight(member.sinceHeight)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
