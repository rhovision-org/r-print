/**
 * Fixture-backed reader. It implements every read method and leaves writes to the stub, so
 * the reference pages render offline in CI and in a checkout with no node.
 */
import articlesJson from "../fixtures/articles.json";
import catalogueJson from "../fixtures/catalogue.json";
import coordinationJson from "../fixtures/coordination.json";
import editionJson from "../fixtures/edition.json";
import escrowJson from "../fixtures/commission-escrow.json";
import networkJson from "../fixtures/network.json";
import proposalJson from "../fixtures/commission-proposal.json";
import publicationJson from "../fixtures/publication.json";
import type { RprintApi } from "./api";
import { StubApi } from "./stub-api";
import type {
  ArticleState,
  CatalogueEntry,
  Charter,
  CoordinationState,
  EditionState,
  EscrowState,
  Member,
  NetworkStatus,
  ProposalState,
  PublicationState,
  Reply,
  ResolveResult,
} from "./types";

export const FIXTURE_PUBLICATION_URI = publicationJson.charter
  ? "rho:id:fixture-publication-kindling"
  : "";
export const FIXTURE_ARTICLE_URI = "rho:id:fixture-article-water";
export const FIXTURE_EDITION_URI = "rho:id:fixture-edition-1";
export const FIXTURE_PROPOSAL_URI = "rho:id:fixture-proposal-water";
export const FIXTURE_ESCROW_URI = "rho:id:fixture-escrow-water";
export const FIXTURE_COORDINATION_URI = "rho:id:fixture-coordination-water";

const publication = publicationJson as unknown as PublicationState;
const proposal = proposalJson as unknown as ProposalState;
const escrow = escrowJson as unknown as EscrowState;
const articles = articlesJson as unknown as ArticleState[];
const edition = editionJson as unknown as EditionState;
const coordination = coordinationJson as unknown as CoordinationState;
const network = networkJson as unknown as NetworkStatus;
const catalogue = catalogueJson as unknown as CatalogueEntry[];

const components: Record<string, string> = {
  "component:publication-factory": "rho:id:fixture-publication-factory",
  "component:publication-cell-factory": "rho:id:fixture-publication-cell-factory",
  "component:commission-factory": "rho:id:fixture-commission-factory",
  "component:commission-escrow-factory": "rho:id:fixture-escrow-factory",
  "component:article-factory": "rho:id:fixture-article-factory",
  "component:edition-factory": "rho:id:fixture-edition-factory",
  "component:rgen-adapter": "rho:id:fixture-rgen-adapter",
  "component:rsure-adapter": "rho:id:fixture-rsure-adapter",
  "component:payments": "rho:id:fixture-payments",
};

export function fixtureCatalogue(): CatalogueEntry[] {
  return catalogue;
}

export class FixtureApi extends StubApi implements RprintApi {
  override resolveComponent(key: string): Promise<Reply<ResolveResult>> {
    const uri = components[key];
    if (!uri) {
      return Promise.resolve({ ok: false, reason: "unknown component" });
    }
    return Promise.resolve({ ok: true, value: { component: key, uri, version: 1 } });
  }

  override networkStatus(): Promise<Reply<NetworkStatus>> {
    return Promise.resolve({ ok: true, value: network });
  }

  override publicationInfo(uri: string): Promise<Reply<PublicationState>> {
    if (uri !== FIXTURE_PUBLICATION_URI) {
      return Promise.resolve({ ok: false, reason: "unknown publication" });
    }
    return Promise.resolve({ ok: true, value: publication });
  }

  override publicationCharter(uri: string): Promise<Reply<Charter>> {
    if (uri !== FIXTURE_PUBLICATION_URI) {
      return Promise.resolve({ ok: false, reason: "unknown publication" });
    }
    return Promise.resolve({ ok: true, value: publication.charter });
  }

  override publicationMembers(uri: string): Promise<Reply<Record<string, Member>>> {
    if (uri !== FIXTURE_PUBLICATION_URI) {
      return Promise.resolve({ ok: false, reason: "unknown publication" });
    }
    return Promise.resolve({ ok: true, value: publication.members });
  }

  override commissionProposalInfo(uri: string): Promise<Reply<ProposalState>> {
    if (uri !== FIXTURE_PROPOSAL_URI) {
      return Promise.resolve({ ok: false, reason: "unknown proposal" });
    }
    return Promise.resolve({ ok: true, value: proposal });
  }

  override escrowInfo(uri: string): Promise<Reply<EscrowState>> {
    if (uri !== FIXTURE_ESCROW_URI) {
      return Promise.resolve({ ok: false, reason: "unknown escrow" });
    }
    return Promise.resolve({ ok: true, value: escrow });
  }

  override articleInfo(uri: string): Promise<Reply<ArticleState>> {
    const entry = catalogue.find((item) => item.uri === uri && item.kind === "article");
    const article = entry
      ? articles.find((item) => item.articleId === entry.id)
      : articles.find((item) => `rho:id:fixture-${item.articleId.replace(/:/g, "-")}` === uri);
    if (!article) {
      return Promise.resolve({ ok: false, reason: "unknown article" });
    }
    return Promise.resolve({ ok: true, value: article });
  }

  override editionInfo(uri: string): Promise<Reply<EditionState>> {
    if (uri !== FIXTURE_EDITION_URI) {
      return Promise.resolve({ ok: false, reason: "unknown edition" });
    }
    return Promise.resolve({ ok: true, value: edition });
  }

  override coordinationInfo(_uri: string): Promise<Reply<CoordinationState>> {
    return Promise.resolve({ ok: true, value: coordination });
  }
}
