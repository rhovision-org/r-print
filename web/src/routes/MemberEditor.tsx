import { Link, useParams } from "react-router-dom";
import { ActionPanel } from "../components/ActionPanel";
import { AsyncBlock } from "../components/AsyncBlock";
import { MemberTable } from "../components/MemberTable";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { useAsync } from "../lib/useAsync";

export function MemberEditor() {
  const { uri = "" } = useParams();
  const api = useApi();
  const members = useAsync(() => api.publicationMembers(uri), `${uri}:members`);

  return (
    <div>
      <p className="crumbs">
        <Link to="/">Catalogue</Link> /{" "}
        <Link to={`/publication/${encodeURIComponent(uri)}`}>publication</Link> / roster
      </p>
      <h1>Roster</h1>
      <p className="muted">
        A member is keyed by the REV address of the key that signs. A publisher adds the
        address; only that key can act as the member. Removing the last active publisher is
        refused.
      </p>

      <section className="panel">
        <AsyncBlock state={members}>{(value) => <MemberTable members={value} />}</AsyncBlock>
      </section>

      <ActionPanel
        title="Roster actions"
        description="Publisher-only roster writes. Each action is idempotent by op id on the chain."
        actions={[
          {
            label: "Add member",
            method: "addMember",
            description: "REV address + role + DID",
            run: (api) =>
              api.addMember(uri, {
                opId: "add-op",
                memberId: "1111member",
                role: "writer",
                did: "did:byoid:writer",
                attestationHash: "att:writer",
              }),
          },
          {
            label: "Set role",
            method: "setRole",
            description: "Change a role",
            run: (api) =>
              api.setRole(uri, { opId: "role-op", memberId: "1111member", role: "editor" }),
          },
          {
            label: "Remove member",
            method: "removeMember",
            description: "Mark removed, never delete",
            run: (api) => api.removeMember(uri, { opId: "remove-op", memberId: "1111member" }),
          },
          {
            label: "Attest self",
            method: "attestSelf",
            description: "Attach a DID/credential anchor",
            run: (api) =>
              api.attestSelf(uri, {
                opId: "attest-op",
                memberId: "1111self",
                did: "did:byoid:self",
                attestationHash: "att:self",
              }),
          },
        ]}
      />

      <SurfaceChecklist
        title="Surface on this screen"
        methods={["addMember", "removeMember", "setRole", "attestSelf"]}
      />
    </div>
  );
}
