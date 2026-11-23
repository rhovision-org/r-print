import { WRITE_METHODS, type WriteMethod } from "../../src/lib/api";
import { SIMPLE_FORMS } from "../../src/components/forms/specs";

/** Fixture entity URIs, matching `web/src/lib/fixture-api.ts`. */
export const FIXTURES = {
  publication: "rho:id:fixture-publication-kindling",
  article: "rho:id:fixture-article-water",
  edition: "rho:id:fixture-edition-1",
  proposal: "rho:id:fixture-proposal-water",
  escrow: "rho:id:fixture-escrow-water",
  coordination: "rho:id:fixture-coordination-water",
} as const;

export interface FormRoute {
  path: string;
  methods: WriteMethod[];
}

function enc(uri: string): string {
  return encodeURIComponent(uri);
}

/**
 * Every write form the browser renders. `createEdition` is intentionally listed twice:
 * it is reachable from the publication screen and from an existing edition.
 */
export const FORM_ROUTES: FormRoute[] = [
  {
    path: "/",
    methods: ["createPublication", "proposeCommission", "createArticle"],
  },
  {
    path: `/publication/${enc(FIXTURES.publication)}`,
    methods: ["pausePublication", "publicationAdmin", "createEdition"],
  },
  {
    path: `/publication/${enc(FIXTURES.publication)}/members`,
    methods: ["addMember", "setRole", "removeMember", "attestSelf"],
  },
  {
    path: `/commission/${enc(FIXTURES.proposal)}`,
    methods: ["acceptProposal", "fundProposal", "cancelProposal", "attachCover"],
  },
  {
    path: `/escrow/${enc(FIXTURES.escrow)}`,
    methods: [
      "submitMilestone",
      "releaseMilestone",
      "cancelEscrow",
      "disputeEscrow",
      "expireEscrow",
      "resolveDispute",
      "arbitrateEscrow",
    ],
  },
  {
    path: `/article/${enc(FIXTURES.article)}`,
    methods: [
      "submitArticle",
      "attachKnowledge",
      "attestArticle",
      "approveArticle",
      "publishArticle",
      "correctArticle",
      "retractArticle",
    ],
  },
  {
    path: `/edition/${enc(FIXTURES.edition)}`,
    methods: ["createEdition", "appendEditionArticle", "sealEdition"],
  },
  {
    path: "/keystore",
    methods: ["keystoreCreate", "keystoreUnlock"],
  },
];

export const COVERED_METHODS = new Set<WriteMethod>(
  FORM_ROUTES.flatMap((route) => route.methods),
);

export const FORM_INSTANCE_COUNT = FORM_ROUTES.reduce(
  (total, route) => total + route.methods.length,
  0,
);

const BESPOKE_LABELS: Partial<Record<WriteMethod, string[]>> = {
  createPublication: [
    "Publication id",
    "Name hash",
    "Masthead hash",
    "Tagline hash",
    "Treasury account",
    "Admin public keys",
    "Admin threshold",
  ],
  proposeCommission: [
    "Proposal id",
    "Publication id",
    "Canonical publication URI",
    "Writer DID",
    "Title hash",
    "Brief hash",
    "Total (minor units)",
  ],
  createArticle: [
    "Article id",
    "Publication id",
    "Canonical publication URI",
    "Content hash",
  ],
  sealEdition: [],
  publicationAdmin: ["Nonce (must be above the stored nonce)", "Action"],
  arbitrateEscrow: [
    "Nonce (must be above the stored nonce)",
    "Writer share (basis points of the remaining balance)",
  ],
  keystoreCreate: ["Label", "Password"],
  keystoreUnlock: ["Keystore", "Password"],
};

const BESPOKE_SUBMIT: Partial<Record<WriteMethod, string>> = {
  createPublication: "Create publication",
  proposeCommission: "Propose commission",
  createArticle: "Create article",
  sealEdition: "Sign and seal",
  publicationAdmin: "Submit admin action",
  arbitrateEscrow: "Submit split",
  keystoreCreate: "Create",
  keystoreUnlock: "Unlock",
};

export function expectedLabels(method: WriteMethod): string[] {
  const spec = SIMPLE_FORMS[method];
  if (spec) {
    return ["Operation id (replay key)", ...spec.fields.map((field) => field.label)];
  }
  return BESPOKE_LABELS[method] ?? [];
}

export function submitLabel(method: WriteMethod): string {
  const spec = SIMPLE_FORMS[method];
  return BESPOKE_SUBMIT[method] ?? spec?.submitLabel ?? "Submit";
}

export function isKeystore(method: WriteMethod): boolean {
  return method.startsWith("keystore");
}

export { WRITE_METHODS };
