import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api-context";
import { newOpId } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import type { Milestone } from "../../lib/types";
import {
  CheckboxField,
  NumberField,
  Repeater,
  SelectField,
  TextField,
} from "./fields";
import { FormPanel } from "./FormPanel";
import { useSubmit } from "./useSubmit";

interface MilestoneRow {
  key: number;
  id: string;
  kind: Milestone["kind"];
  amount: number;
  deadlineHeight: number;
}

const KINDS: Array<{ value: Milestone["kind"]; label: string }> = [
  "stipend",
  "draft",
  "final",
  "expense",
  "bonus",
].map((kind) => ({ value: kind as Milestone["kind"], label: kind }));

export function ProposeCommissionForm({ onDone }: { onDone?: () => void }) {
  const api = useApi();
  const session = useSession();
  const { settings, update } = useSettings();
  const submit = useSubmit();
  const [opId] = useState(() => newOpId("proposeCommission"));
  const [proposalId, setProposalId] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [publicationUri, setPublicationUri] = useState("");
  const [writerDid, setWriterDid] = useState(
    session.address ? `byoid:rev:${session.address}` : "",
  );
  const [titleHash, setTitleHash] = useState("");
  const [briefHash, setBriefHash] = useState("");
  const [total, setTotal] = useState(0);
  const [graceBlocks, setGraceBlocks] = useState(10);
  const [disputeWindowBlocks, setDisputeWindowBlocks] = useState(20);
  const [requireFactCheck, setRequireFactCheck] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { key: 1, id: "m1", kind: "stipend", amount: 0, deadlineHeight: 0 },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [createdUri, setCreatedUri] = useState<string | null>(null);

  const canWrite = settings.mode === "live" && session.unlocked;
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "The contract derives the writer id from the connected REV address; the total must equal the milestone sum.";

  function updateRow(key: number, patch: Partial<MilestoneRow>) {
    setMilestones((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  const milestoneSum = milestones.reduce((sum, row) => sum + row.amount, 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = await submit.run(() =>
      api.proposeCommission({
        proposalId,
        opId,
        publicationId,
        publicationUri,
        writerDid,
        titleHash,
        briefHash,
        total,
        milestones: milestones.map((row) => ({
          id: row.id,
          kind: row.kind,
          amount: row.amount,
          deadlineHeight: row.deadlineHeight,
        })),
        graceBlocks,
        disputeWindowBlocks,
        requireFactCheck,
      }),
    );
    if (reply?.ok) {
      const value = reply.value as { uri: string };
      setCreatedUri(value.uri);
      if (!settings.catalogue.some((entry) => entry.uri === value.uri)) {
        update({
          catalogue: [
            ...settings.catalogue,
            {
              id: proposalId || value.uri,
              title: `Commission ${proposalId || value.uri}`,
              uri: value.uri,
              kind: "commission",
            },
          ],
        });
      }
      onDone?.();
    }
  }

  return (
    <FormPanel
      method="proposeCommission"
      title="Commission a story or investigation"
      description={`CommissionFactory("propose"). ${note}`}
      onSubmit={onSubmit}
      submitLabel="Propose commission"
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error}
      footer={
        createdUri ? (
          <p>
            Proposed <Link to={`/commission/${encodeURIComponent(createdUri)}`}>{createdUri}</Link>
          </p>
        ) : null
      }
    >
      <TextField label="Proposal id" name="proposalId" value={proposalId} onChange={setProposalId} disabled={!canWrite} />
      <TextField label="Publication id" name="publicationId" value={publicationId} onChange={setPublicationId} disabled={!canWrite} />
      <TextField label="Canonical publication URI" name="publicationUri" value={publicationUri} onChange={setPublicationUri} disabled={!canWrite} />
      <TextField label="Writer DID" name="writerDid" value={writerDid} onChange={setWriterDid} disabled={!canWrite} />
      <TextField label="Title hash" name="titleHash" value={titleHash} onChange={setTitleHash} disabled={!canWrite} />
      <TextField label="Brief hash" name="briefHash" value={briefHash} onChange={setBriefHash} disabled={!canWrite} />
      <NumberField label="Total (minor units)" name="total" value={total} onChange={setTotal} min={0} disabled={!canWrite} />
      <p className={milestoneSum === total ? "muted" : "error"}>
        Milestone sum: {milestoneSum} / total {total}
      </p>
      <NumberField label="Grace blocks" name="graceBlocks" value={graceBlocks} onChange={setGraceBlocks} min={0} disabled={!canWrite} />
      <NumberField label="Dispute window (blocks)" name="disputeWindow" value={disputeWindowBlocks} onChange={setDisputeWindowBlocks} min={0} disabled={!canWrite} />
      <CheckboxField label="Require fact-check before approval" name="requireFactCheck" checked={requireFactCheck} onChange={setRequireFactCheck} disabled={!canWrite} />

      <Repeater
        label="Milestones (deadline is a block height, not a timestamp)"
        rows={milestones.map((row) => row.key)}
        onAdd={() => {
          setMilestones((current) => [
            ...current,
            {
              key: nextKey,
              id: `m${nextKey}`,
              kind: "draft",
              amount: 0,
              deadlineHeight: 0,
            },
          ]);
          setNextKey((key) => key + 1);
        }}
        onRemove={(key) =>
          setMilestones((current) => current.filter((row) => row.key !== key))
        }
        addLabel="Add milestone"
      >
        {(key) => {
          const row = milestones.find((item) => item.key === key);
          if (!row) return null;
          return (
            <>
              <TextField label="Milestone id" name={`id-${key}`} value={row.id} onChange={(value) => updateRow(key, { id: value })} disabled={!canWrite} />
              <SelectField label="Kind" name={`kind-${key}`} value={row.kind} options={KINDS} onChange={(value) => updateRow(key, { kind: value })} disabled={!canWrite} />
              <NumberField label="Amount" name={`amount-${key}`} value={row.amount} onChange={(value) => updateRow(key, { amount: value })} min={0} disabled={!canWrite} />
              <NumberField label="Deadline height" name={`deadline-${key}`} value={row.deadlineHeight} onChange={(value) => updateRow(key, { deadlineHeight: value })} min={0} disabled={!canWrite} />
            </>
          );
        }}
      </Repeater>
    </FormPanel>
  );
}
