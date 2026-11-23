import { WRITE_METHODS, type WriteMethod } from "../../lib/api";
import { ArbitrateEscrowForm } from "./ArbitrateEscrowForm";
import { CreateArticleForm } from "./CreateArticleForm";
import { CreatePublicationForm } from "./CreatePublicationForm";
import { ProposeCommissionForm } from "./ProposeCommissionForm";
import { PublicationAdminForm } from "./PublicationAdminForm";
import { SealEditionForm } from "./SealEditionForm";
import { SimpleForm } from "./SimpleForm";
import { SIMPLE_FORMS } from "./specs";

/** The methods with a bespoke (nested or multisig) form rather than a scalar spec. */
export const BESPOKE_METHODS: WriteMethod[] = [
  "createPublication",
  "proposeCommission",
  "createArticle",
  "sealEdition",
  "publicationAdmin",
  "arbitrateEscrow",
  "keystoreCreate",
  "keystoreUnlock",
];

/** Every write method is implemented by a simple spec, a bespoke form or the Keystore page. */
export const FORM_IMPLEMENTATIONS: WriteMethod[] = WRITE_METHODS.filter(
  (method) =>
    method in SIMPLE_FORMS || BESPOKE_METHODS.includes(method),
);

/** Render the form for one write method. Keystore forms live on the Keystore page. */
export function FormFor({
  method,
  uri = "",
  onDone,
  defaults,
}: {
  method: WriteMethod;
  uri?: string;
  onDone?: () => void;
  defaults?: Record<string, string | number | boolean>;
}) {
  switch (method) {
    case "createPublication":
      return <CreatePublicationForm onDone={onDone} />;
    case "proposeCommission":
      return <ProposeCommissionForm onDone={onDone} />;
    case "createArticle":
      return <CreateArticleForm onDone={onDone} />;
    case "sealEdition":
      return <SealEditionForm uri={uri} onDone={onDone} />;
    case "publicationAdmin":
      return <PublicationAdminForm uri={uri} onDone={onDone} />;
    case "arbitrateEscrow":
      return <ArbitrateEscrowForm uri={uri} onDone={onDone} />;
    case "keystoreCreate":
    case "keystoreUnlock":
      return null;
    default: {
      const spec = SIMPLE_FORMS[method];
      return spec ? (
        <SimpleForm spec={spec} uri={uri} onDone={onDone} defaults={defaults} />
      ) : null;
    }
  }
}
