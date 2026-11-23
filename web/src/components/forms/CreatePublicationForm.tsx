import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api-context";
import { newOpId, splitKeys } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import type { Charter, Role } from "../../lib/types";
import {
  CheckboxField,
  KeyListField,
  NumberField,
  Repeater,
  SelectField,
  TextField,
} from "./fields";
import { FormPanel } from "./FormPanel";
import { useSubmit } from "./useSubmit";

interface MemberRow {
  key: number;
  memberId: string;
  role: Role;
  did: string;
  attestationHash: string;
}

interface SplitRow {
  key: number;
  memberId: string;
  bps: number;
}

const ROLES: Array<{ value: Role; label: string }> = [
  "publisher",
  "editor",
  "writer",
  "factchecker",
  "treasurer",
  "contributor",
].map((role) => ({ value: role as Role, label: role }));

export function CreatePublicationForm({ onDone }: { onDone?: () => void }) {
  const api = useApi();
  const session = useSession();
  const { settings, update } = useSettings();
  const submit = useSubmit();
  const [opId] = useState(() => newOpId("createPublication"));
  const [publicationId, setPublicationId] = useState("");
  const [nameHash, setNameHash] = useState("");
  const [mastheadHash, setMastheadHash] = useState("");
  const [taglineHash, setTaglineHash] = useState("");
  const [treasury, setTreasury] = useState(session.address ?? "");
  const [admins, setAdmins] = useState(session.publicKey ?? "");
  const [threshold, setThreshold] = useState(1);
  const [arbitrators, setArbitrators] = useState("");
  const [arbitrationThreshold, setArbitrationThreshold] = useState(0);
  const [maxMembers, setMaxMembers] = useState(32);
  const [requireFactCheck, setRequireFactCheck] = useState(false);
  const [disputeWindowBlocks, setDisputeWindowBlocks] = useState(10);
  const [commissionGraceBlocks, setCommissionGraceBlocks] = useState(5);
  const [members, setMembers] = useState<MemberRow[]>(() =>
    session.address
      ? [
          {
            key: 1,
            memberId: session.address,
            role: "publisher",
            did: `byoid:rev:${session.address}`,
            attestationHash: "",
          },
        ]
      : [{ key: 1, memberId: "", role: "publisher", did: "", attestationHash: "" }],
  );
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [nextKey, setNextKey] = useState(2);
  const [createdUri, setCreatedUri] = useState<string | null>(null);

  const canWrite = settings.mode === "live" && session.unlocked;
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "The connected REV address is the creator and must be listed as a publisher.";

  function updateMember(key: number, patch: Partial<MemberRow>) {
    setMembers((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function updateSplit(key: number, patch: Partial<SplitRow>) {
    setSplits((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const charter: Charter = {
      nameHash,
      mastheadHash,
      taglineHash,
      foundedAtHeight: 0,
      treasuryAccountId: treasury,
      assetId: "REV",
      revenueSplit: splits
        .filter((row) => row.memberId.trim())
        .map((row) => ({ memberId: row.memberId.trim(), bps: row.bps })),
      admins: splitKeys(admins),
      threshold,
      governance: {
        maxMembers,
        requireFactCheck,
        requireKAsset: false,
        disputeWindowBlocks,
        commissionGraceBlocks,
        arbitrators: splitKeys(arbitrators),
        arbitrationThreshold,
      },
    };
    const rows = members
      .filter((row) => row.memberId.trim())
      .map((row) => ({
        memberId: row.memberId.trim(),
        role: row.role,
        did: row.did,
        attestationHash: row.attestationHash,
      }));
    const reply = await submit.run(() =>
      api.createPublication({ publicationId, opId, charter, members: rows }),
    );
    if (reply?.ok) {
      const value = reply.value as { uri: string };
      setCreatedUri(value.uri);
      if (!settings.catalogue.some((entry) => entry.uri === value.uri)) {
        update({
          catalogue: [
            ...settings.catalogue,
            {
              id: publicationId || value.uri,
              title: publicationId || value.uri,
              uri: value.uri,
              kind: "publication",
            },
          ],
        });
      }
      onDone?.();
    }
  }

  return (
    <FormPanel
      method="createPublication"
      title="Found a publication"
      description={`PublicationFactory("create"). ${note}`}
      onSubmit={onSubmit}
      submitLabel="Create publication"
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error}
      footer={
        createdUri ? (
          <p>
            Created <Link to={`/publication/${encodeURIComponent(createdUri)}`}>{createdUri}</Link>
          </p>
        ) : null
      }
    >
      <TextField
        label="Publication id"
        name="publicationId"
        value={publicationId}
        onChange={setPublicationId}
        disabled={!canWrite}
        placeholder="pub:kindling"
      />
      <TextField label="Name hash" name="nameHash" value={nameHash} onChange={setNameHash} disabled={!canWrite} />
      <TextField label="Masthead hash" name="mastheadHash" value={mastheadHash} onChange={setMastheadHash} disabled={!canWrite} />
      <TextField label="Tagline hash" name="taglineHash" value={taglineHash} onChange={setTaglineHash} disabled={!canWrite} />
      <TextField label="Treasury account" name="treasury" value={treasury} onChange={setTreasury} disabled={!canWrite} />
      <KeyListField label="Admin public keys" name="admins" value={admins} onChange={setAdmins} disabled={!canWrite} />
      <NumberField label="Admin threshold" name="threshold" value={threshold} onChange={setThreshold} min={1} max={5} disabled={!canWrite} />
      <KeyListField
        label="Arbitrator public keys (optional; 2–5, threshold ≥ 2)"
        name="arbitrators"
        value={arbitrators}
        onChange={setArbitrators}
        disabled={!canWrite}
      />
      <NumberField
        label="Arbitration threshold (0 when no arbitrators)"
        name="arbitrationThreshold"
        value={arbitrationThreshold}
        onChange={setArbitrationThreshold}
        min={0}
        max={5}
        disabled={!canWrite}
      />
      <NumberField label="Max members" name="maxMembers" value={maxMembers} onChange={setMaxMembers} min={1} max={64} disabled={!canWrite} />
      <NumberField label="Dispute window (blocks)" name="disputeWindow" value={disputeWindowBlocks} onChange={setDisputeWindowBlocks} min={0} disabled={!canWrite} />
      <NumberField label="Commission grace (blocks)" name="commissionGrace" value={commissionGraceBlocks} onChange={setCommissionGraceBlocks} min={0} disabled={!canWrite} />
      <CheckboxField label="Require fact-check before approval" name="requireFactCheck" checked={requireFactCheck} onChange={setRequireFactCheck} disabled={!canWrite} />

      <Repeater
        label="Founding members"
        rows={members.map((row) => row.key)}
        onAdd={() => {
          setMembers((current) => [
            ...current,
            { key: nextKey, memberId: "", role: "writer", did: "", attestationHash: "" },
          ]);
          setNextKey((key) => key + 1);
        }}
        onRemove={(key) => setMembers((current) => current.filter((row) => row.key !== key))}
      >
        {(key) => {
          const row = members.find((item) => item.key === key);
          if (!row) return null;
          return (
            <>
              <TextField label="REV address" name={`member-${key}`} value={row.memberId} onChange={(value) => updateMember(key, { memberId: value })} disabled={!canWrite} />
              <SelectField label="Role" name={`role-${key}`} value={row.role} options={ROLES} onChange={(value) => updateMember(key, { role: value })} disabled={!canWrite} />
              <TextField label="DID" name={`did-${key}`} value={row.did} onChange={(value) => updateMember(key, { did: value })} disabled={!canWrite} />
              <TextField label="Attestation hash" name={`att-${key}`} value={row.attestationHash} onChange={(value) => updateMember(key, { attestationHash: value })} disabled={!canWrite} />
            </>
          );
        }}
      </Repeater>

      <Repeater
        label="Revenue split (design surface; validated to 10000 bps)"
        rows={splits.map((row) => row.key)}
        onAdd={() => {
          setSplits((current) => [...current, { key: nextKey, memberId: "", bps: 0 }]);
          setNextKey((key) => key + 1);
        }}
        onRemove={(key) => setSplits((current) => current.filter((row) => row.key !== key))}
        addLabel="Add split row"
      >
        {(key) => {
          const row = splits.find((item) => item.key === key);
          if (!row) return null;
          return (
            <>
              <TextField label="Member id" name={`split-member-${key}`} value={row.memberId} onChange={(value) => updateSplit(key, { memberId: value })} disabled={!canWrite} />
              <NumberField label="Basis points" name={`split-bps-${key}`} value={row.bps} onChange={(value) => updateSplit(key, { bps: value })} min={0} max={10000} disabled={!canWrite} />
            </>
          );
        }}
      </Repeater>
    </FormPanel>
  );
}
