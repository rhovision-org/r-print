import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api-context";
import { newOpId } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import type { ArticleState } from "../../lib/types";
import {
  CheckboxField,
  Repeater,
  SelectField,
  TextField,
} from "./fields";
import { FormPanel } from "./FormPanel";
import { useSubmit } from "./useSubmit";

interface AuthorRow {
  key: number;
  memberId: string;
  did: string;
  bylineHash: string;
}

const LICENSES = ["all-rights", "cc-by-4.0", "cc-by-sa-4.0", "cc0", "custom"].map(
  (license) => ({ value: license, label: license }),
);

const ACCESS: Array<{ value: ArticleState["access"]; label: string }> = [
  { value: "open", label: "open" },
  { value: "members", label: "members" },
  { value: "embargoed", label: "embargoed" },
];

export function CreateArticleForm({ onDone }: { onDone?: () => void }) {
  const api = useApi();
  const session = useSession();
  const { settings, update } = useSettings();
  const submit = useSubmit();
  const [opId] = useState(() => newOpId("createArticle"));
  const [articleId, setArticleId] = useState("");
  const [publicationId, setPublicationId] = useState("");
  const [publicationUri, setPublicationUri] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [license, setLicense] = useState("cc-by-4.0");
  const [customLicenseHash, setCustomLicenseHash] = useState("");
  const [access, setAccess] = useState<ArticleState["access"]>("open");
  const [sectionHash, setSectionHash] = useState("");
  const [requireFactCheck, setRequireFactCheck] = useState(false);
  const [requireKAsset, setRequireKAsset] = useState(false);
  const [authors, setAuthors] = useState<AuthorRow[]>(() =>
    session.address
      ? [
          {
            key: 1,
            memberId: session.address,
            did: `byoid:rev:${session.address}`,
            bylineHash: "",
          },
        ]
      : [{ key: 1, memberId: "", did: "", bylineHash: "" }],
  );
  const [nextKey, setNextKey] = useState(2);
  const [createdUri, setCreatedUri] = useState<string | null>(null);

  const canWrite = settings.mode === "live" && session.unlocked;
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "You must be one of the listed authors and an active member of the publication.";

  function updateAuthor(key: number, patch: Partial<AuthorRow>) {
    setAuthors((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = await submit.run(() =>
      api.createArticle({
        articleId,
        opId,
        publicationId,
        publicationUri,
        authors: authors
          .filter((row) => row.memberId.trim())
          .map((row) => ({
            memberId: row.memberId.trim(),
            did: row.did,
            bylineHash: row.bylineHash,
          })),
        contentHash,
        license,
        customLicenseHash,
        access,
        sectionHash,
        requireFactCheck,
        requireKAsset,
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
              id: articleId || value.uri,
              title: `Article ${articleId || value.uri}`,
              uri: value.uri,
              kind: "article",
            },
          ],
        });
      }
      onDone?.();
    }
  }

  return (
    <FormPanel
      method="createArticle"
      title="Register an article"
      description={`ArticleFactory("create"). ${note}`}
      onSubmit={onSubmit}
      submitLabel="Create article"
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error}
      footer={
        createdUri ? (
          <p>
            Registered <Link to={`/article/${encodeURIComponent(createdUri)}`}>{createdUri}</Link>
          </p>
        ) : null
      }
    >
      <TextField label="Article id" name="articleId" value={articleId} onChange={setArticleId} disabled={!canWrite} />
      <TextField label="Publication id" name="publicationId" value={publicationId} onChange={setPublicationId} disabled={!canWrite} />
      <TextField label="Canonical publication URI" name="publicationUri" value={publicationUri} onChange={setPublicationUri} disabled={!canWrite} />
      <TextField label="Content hash" name="contentHash" value={contentHash} onChange={setContentHash} disabled={!canWrite} />
      <SelectField label="License" name="license" value={license} options={LICENSES} onChange={setLicense} disabled={!canWrite} />
      <TextField label="Custom license hash (when custom)" name="customLicense" value={customLicenseHash} onChange={setCustomLicenseHash} disabled={!canWrite} />
      <SelectField label="Access" name="access" value={access} options={ACCESS} onChange={setAccess} disabled={!canWrite} />
      <TextField label="Section hash" name="sectionHash" value={sectionHash} onChange={setSectionHash} disabled={!canWrite} />
      <CheckboxField label="Require fact-check before approval" name="requireFactCheck" checked={requireFactCheck} onChange={setRequireFactCheck} disabled={!canWrite} />
      <CheckboxField label="Require an r-gen K-Asset (opt-in)" name="requireKAsset" checked={requireKAsset} onChange={setRequireKAsset} disabled={!canWrite} />

      <Repeater
        label="Authors"
        rows={authors.map((row) => row.key)}
        onAdd={() => {
          setAuthors((current) => [
            ...current,
            { key: nextKey, memberId: "", did: "", bylineHash: "" },
          ]);
          setNextKey((key) => key + 1);
        }}
        onRemove={(key) => setAuthors((current) => current.filter((row) => row.key !== key))}
        addLabel="Add author"
      >
        {(key) => {
          const row = authors.find((item) => item.key === key);
          if (!row) return null;
          return (
            <>
              <TextField label="REV address" name={`author-${key}`} value={row.memberId} onChange={(value) => updateAuthor(key, { memberId: value })} disabled={!canWrite} />
              <TextField label="DID" name={`did-${key}`} value={row.did} onChange={(value) => updateAuthor(key, { did: value })} disabled={!canWrite} />
              <TextField label="Byline hash" name={`byline-${key}`} value={row.bylineHash} onChange={(value) => updateAuthor(key, { bylineHash: value })} disabled={!canWrite} />
            </>
          );
        }}
      </Repeater>
    </FormPanel>
  );
}
