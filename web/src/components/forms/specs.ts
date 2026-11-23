import type { RprintApi } from "../../lib/api";
import type { SessionContextValue } from "../../lib/session";
import type { Settings } from "../../lib/settings";
import type { WriteMethod } from "../../lib/api";
import type { Attestation, Correction, Reply, Role } from "../../lib/types";

export type FormValue = string | number | boolean;
export type FormValues = Record<string, FormValue>;

export interface FormContext {
  uri: string;
  api: RprintApi;
  session: SessionContextValue;
  settings: Settings;
}

export type FieldSpec =
  | {
      kind: "text" | "password" | "url" | "textarea";
      name: string;
      label: string;
      default?: string;
      placeholder?: string;
    }
  | {
      kind: "number";
      name: string;
      label: string;
      default?: number;
      min?: number;
      max?: number;
    }
  | { kind: "checkbox"; name: string; label: string; default?: boolean }
  | {
      kind: "select";
      name: string;
      label: string;
      default: string;
      options: Array<{ value: string; label: string }>;
    };

export interface FormSpec {
  method: WriteMethod;
  title: string;
  description: string;
  submitLabel?: string;
  fields: FieldSpec[];
  submit: (values: FormValues, context: FormContext) => Promise<Reply<unknown>>;
}

const ROLE_OPTIONS = [
  "publisher",
  "editor",
  "writer",
  "factchecker",
  "treasurer",
  "contributor",
].map((role) => ({ value: role, label: role }));

function text(values: FormValues, name: string): string {
  const value = values[name];
  return typeof value === "string" ? value : "";
}

function numberValue(values: FormValues, name: string): number {
  const value = values[name];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function bool(values: FormValues, name: string): boolean {
  return values[name] === true;
}

/** Simple, single-shot forms. Complex nested inputs have bespoke components. */
export const SIMPLE_FORMS: Partial<Record<WriteMethod, FormSpec>> = {
  addMember: {
    method: "addMember",
    title: "Add member",
    description:
      "The member id is the intended REV address; the publisher adds it, and only that key can act as the member.",
    fields: [
      { kind: "text", name: "memberId", label: "REV address" },
      { kind: "select", name: "role", label: "Role", default: "writer", options: ROLE_OPTIONS },
      { kind: "text", name: "did", label: "DID (interface only)", default: "did:byoid:" },
      { kind: "text", name: "attestationHash", label: "Attestation hash" },
    ],
    submit: (values, context) =>
      context.api.addMember(context.uri, {
        opId: text(values, "opId"),
        memberId: text(values, "memberId"),
        role: text(values, "role") as Role,
        did: text(values, "did"),
        attestationHash: text(values, "attestationHash"),
      }),
  },
  removeMember: {
    method: "removeMember",
    title: "Remove member",
    description: "Removal marks the member removed; the last active publisher is refused.",
    fields: [{ kind: "text", name: "memberId", label: "REV address" }],
    submit: (values, context) =>
      context.api.removeMember(context.uri, {
        opId: text(values, "opId"),
        memberId: text(values, "memberId"),
      }),
  },
  setRole: {
    method: "setRole",
    title: "Set role",
    description: "Changing the last publisher's role is refused.",
    fields: [
      { kind: "text", name: "memberId", label: "REV address" },
      { kind: "select", name: "role", label: "Role", default: "writer", options: ROLE_OPTIONS },
    ],
    submit: (values, context) =>
      context.api.setRole(context.uri, {
        opId: text(values, "opId"),
        memberId: text(values, "memberId"),
        role: text(values, "role") as Role,
      }),
  },
  attestSelf: {
    method: "attestSelf",
    title: "Attest self",
    description: "Attach a DID or credential hash to your own member row.",
    fields: [
      { kind: "text", name: "did", label: "DID", default: "did:byoid:" },
      { kind: "text", name: "attestationHash", label: "Attestation hash" },
    ],
    submit: (values, context) =>
      context.api.attestSelf(context.uri, {
        opId: text(values, "opId"),
        memberId: "",
        did: text(values, "did"),
        attestationHash: text(values, "attestationHash"),
      }),
  },
  pausePublication: {
    method: "pausePublication",
    title: "Pause or resume",
    description:
      "Pause blocks new commissions and articles; existing escrow releases remain available.",
    fields: [{ kind: "checkbox", name: "paused", label: "Pause the publication", default: true }],
    submit: (values, context) =>
      context.api.pausePublication(context.uri, {
        opId: text(values, "opId"),
        paused: bool(values, "paused"),
      }),
  },
  attachCover: {
    method: "attachCover",
    title: "Attach an r-sure cover",
    description: "Optional. The escrow rail remains the baseline.",
    fields: [{ kind: "text", name: "coverUri", label: "r-sure policy URI" }],
    submit: (values, context) =>
      context.api.attachCover(context.uri, {
        opId: text(values, "opId"),
        coverUri: text(values, "coverUri"),
      }),
  },
  acceptProposal: {
    method: "acceptProposal",
    title: "Accept proposal",
    description: "An editor or publisher accepts the pitch.",
    fields: [],
    submit: (values, context) =>
      context.api.acceptProposal(context.uri, { opId: text(values, "opId") }),
  },
  fundProposal: {
    method: "fundProposal",
    title: "Fund proposal",
    description:
      "The funder creates the escrow. This requires an r-cash-funded account; the key's native REV vault is not enough.",
    fields: [],
    submit: (values, context) =>
      context.api.fundProposal(context.uri, { opId: text(values, "opId") }),
  },
  cancelProposal: {
    method: "cancelProposal",
    title: "Cancel proposal",
    description: "Cancel before the escrow is funded.",
    fields: [{ kind: "text", name: "reasonHash", label: "Reason hash" }],
    submit: (values, context) =>
      context.api.cancelProposal(context.uri, {
        opId: text(values, "opId"),
        reasonHash: text(values, "reasonHash"),
      }),
  },
  submitMilestone: {
    method: "submitMilestone",
    title: "Submit milestone",
    description: "The writer submits evidence before the deadline plus grace.",
    fields: [
      { kind: "text", name: "milestoneId", label: "Milestone id" },
      { kind: "text", name: "evidenceHash", label: "Evidence hash" },
    ],
    submit: (values, context) =>
      context.api.submitMilestone(context.uri, {
        opId: text(values, "opId"),
        milestoneId: text(values, "milestoneId"),
        evidenceHash: text(values, "evidenceHash"),
      }),
  },
  releaseMilestone: {
    method: "releaseMilestone",
    title: "Release milestone",
    description: "A live editor or publisher releases a submitted milestone.",
    fields: [{ kind: "text", name: "milestoneId", label: "Milestone id" }],
    submit: (values, context) =>
      context.api.releaseMilestone(context.uri, {
        opId: text(values, "opId"),
        milestoneId: text(values, "milestoneId"),
      }),
  },
  cancelEscrow: {
    method: "cancelEscrow",
    title: "Cancel escrow",
    description: "Refunds the remaining balance to the funder.",
    fields: [{ kind: "text", name: "reasonHash", label: "Reason hash" }],
    submit: (values, context) =>
      context.api.cancelEscrow(context.uri, {
        opId: text(values, "opId"),
        reasonHash: text(values, "reasonHash"),
      }),
  },
  disputeEscrow: {
    method: "disputeEscrow",
    title: "Dispute",
    description: "Freezes the escrow and hands it to the arbitration quorum.",
    fields: [{ kind: "text", name: "reasonHash", label: "Reason hash" }],
    submit: (values, context) =>
      context.api.disputeEscrow(context.uri, {
        opId: text(values, "opId"),
        reasonHash: text(values, "reasonHash"),
      }),
  },
  expireEscrow: {
    method: "expireEscrow",
    title: "Expire",
    description: "Permissionless refund after the hard deadline.",
    fields: [],
    submit: (values, context) =>
      context.api.expireEscrow(context.uri, { opId: text(values, "opId") }),
  },
  resolveDispute: {
    method: "resolveDispute",
    title: "Resolve dispute",
    description: "Permissionless conservative refund after the dispute window.",
    fields: [],
    submit: (values, context) =>
      context.api.resolveDispute(context.uri, { opId: text(values, "opId") }),
  },
  submitArticle: {
    method: "submitArticle",
    title: "Submit content hash",
    description: "The author submits a content hash; content stays off-chain.",
    fields: [{ kind: "text", name: "contentHash", label: "Content hash" }],
    submit: (values, context) =>
      context.api.submitArticle(context.uri, {
        opId: text(values, "opId"),
        contentHash: text(values, "contentHash"),
      }),
  },
  attachKnowledge: {
    method: "attachKnowledge",
    title: "Attach r-gen knowledge",
    description: "Optional. Links a Claim, K-Asset, Provenance and credential by URI.",
    fields: [
      { kind: "text", name: "kassetUri", label: "K-Asset URI" },
      { kind: "text", name: "claimUri", label: "Claim URI" },
      { kind: "text", name: "provenanceUri", label: "Provenance URI" },
      { kind: "text", name: "credentialUri", label: "Credential URI (optional)" },
    ],
    submit: (values, context) =>
      context.api.attachKnowledge(context.uri, {
        opId: text(values, "opId"),
        kassetUri: text(values, "kassetUri"),
        claimUri: text(values, "claimUri"),
        provenanceUri: text(values, "provenanceUri"),
        credentialUri: text(values, "credentialUri"),
      }),
  },
  attestArticle: {
    method: "attestArticle",
    title: "Attest",
    description: "Fact-check, legal or editorial attestation.",
    fields: [
      { kind: "text", name: "attestationId", label: "Attestation id" },
      {
        kind: "select",
        name: "kind",
        label: "Kind",
        default: "factcheck",
        options: [
          { value: "factcheck", label: "Fact-check" },
          { value: "legal", label: "Legal" },
          { value: "editor", label: "Editorial" },
        ],
      },
      { kind: "text", name: "evidenceHash", label: "Evidence hash" },
    ],
    submit: (values, context) =>
      context.api.attestArticle(context.uri, {
        opId: text(values, "opId"),
        attestationId: text(values, "attestationId"),
        kind: text(values, "kind") as Attestation["kind"],
        evidenceHash: text(values, "evidenceHash"),
      }),
  },
  approveArticle: {
    method: "approveArticle",
    title: "Approve",
    description: "Editorial approval; the fact-check gate and an opt-in K-Asset gate are enforced.",
    fields: [],
    submit: (values, context) =>
      context.api.approveArticle(context.uri, { opId: text(values, "opId") }),
  },
  publishArticle: {
    method: "publishArticle",
    title: "Publish",
    description: "Publishing freezes the content hash.",
    fields: [],
    submit: (values, context) =>
      context.api.publishArticle(context.uri, { opId: text(values, "opId") }),
  },
  correctArticle: {
    method: "correctArticle",
    title: "Append a correction",
    description: "Corrections are append-only; a published hash is never rewritten.",
    fields: [
      { kind: "text", name: "correctionId", label: "Correction id" },
      {
        kind: "select",
        name: "kind",
        label: "Kind",
        default: "correction",
        options: [
          { value: "correction", label: "Correction" },
          { value: "clarification", label: "Clarification" },
          { value: "retraction", label: "Retraction" },
        ],
      },
      { kind: "text", name: "bodyHash", label: "Body hash" },
      { kind: "text", name: "reasonHash", label: "Reason hash" },
    ],
    submit: (values, context) =>
      context.api.correctArticle(context.uri, {
        opId: text(values, "opId"),
        correctionId: text(values, "correctionId"),
        kind: text(values, "kind") as Correction["kind"],
        bodyHash: text(values, "bodyHash"),
        reasonHash: text(values, "reasonHash"),
      }),
  },
  retractArticle: {
    method: "retractArticle",
    title: "Retract",
    description: "Appends a retraction record; the article remains readable.",
    fields: [{ kind: "text", name: "reasonHash", label: "Reason hash" }],
    submit: (values, context) =>
      context.api.retractArticle(context.uri, {
        opId: text(values, "opId"),
        reasonHash: text(values, "reasonHash"),
      }),
  },
  createEdition: {
    method: "createEdition",
    title: "Create edition",
    description: "Creates the ordered manifest container; append published articles next.",
    fields: [
      { kind: "text", name: "editionId", label: "Edition id" },
      { kind: "text", name: "publicationId", label: "Publication id" },
      { kind: "text", name: "publicationUri", label: "Canonical publication URI" },
      { kind: "number", name: "number", label: "Issue number", default: 1, min: 1 },
      { kind: "text", name: "titleHash", label: "Title hash" },
      { kind: "text", name: "coverHash", label: "Cover hash" },
    ],
    submit: (values, context) =>
      context.api.createEdition({
        editionId: text(values, "editionId"),
        opId: text(values, "opId"),
        publicationId: text(values, "publicationId"),
        publicationUri: text(values, "publicationUri"),
        number: numberValue(values, "number"),
        titleHash: text(values, "titleHash"),
        coverHash: text(values, "coverHash"),
      }),
  },
  appendEditionArticle: {
    method: "appendEditionArticle",
    title: "Append article",
    description: "The article must be published in the same canonical publication.",
    fields: [{ kind: "text", name: "articleUri", label: "Article URI" }],
    submit: (values, context) =>
      context.api.appendEditionArticle(context.uri, {
        opId: text(values, "opId"),
        articleUri: text(values, "articleUri"),
      }),
  },
};
