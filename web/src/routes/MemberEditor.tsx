import { Link, useParams } from "react-router-dom";
import { FormFor } from "../components/forms";
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

      <section className="grid">
        <FormFor method="addMember" uri={uri} onDone={members.reload} />
        <FormFor method="setRole" uri={uri} onDone={members.reload} />
        <FormFor method="removeMember" uri={uri} onDone={members.reload} />
        <FormFor method="attestSelf" uri={uri} onDone={members.reload} />
      </section>

      <SurfaceChecklist
        title="Surface on this screen"
        methods={["addMember", "removeMember", "setRole", "attestSelf"]}
      />
    </div>
  );
}
