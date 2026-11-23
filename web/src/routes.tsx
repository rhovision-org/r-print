import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Article } from "./routes/Article";
import { CommissionEscrow } from "./routes/CommissionEscrow";
import { CommissionProposal } from "./routes/CommissionProposal";
import { Coordination } from "./routes/Coordination";
import { DeployResult } from "./routes/DeployResult";
import { Edition } from "./routes/Edition";
import { Home } from "./routes/Home";
import { Keystore } from "./routes/Keystore";
import { MemberEditor } from "./routes/MemberEditor";
import { Network } from "./routes/Network";
import { NotFound } from "./routes/NotFound";
import { Publication } from "./routes/Publication";

export interface RouteEntry {
  path: string;
  entity: string;
  element: JSX.Element;
}

/** The route table. The coverage test asserts every entity surface has a route. */
export const ROUTE_TABLE: RouteEntry[] = [
  { path: "/", entity: "home", element: <Home /> },
  { path: "/publication/:uri", entity: "publication", element: <Publication /> },
  { path: "/publication/:uri/members", entity: "members", element: <MemberEditor /> },
  { path: "/commission/:uri", entity: "commission-proposal", element: <CommissionProposal /> },
  { path: "/escrow/:uri", entity: "commission-escrow", element: <CommissionEscrow /> },
  { path: "/article/:uri", entity: "article", element: <Article /> },
  { path: "/edition/:uri", entity: "edition", element: <Edition /> },
  { path: "/coordination/:uri", entity: "coordination", element: <Coordination /> },
  { path: "/keystore", entity: "keystore", element: <Keystore /> },
  { path: "/network", entity: "network", element: <Network /> },
  { path: "/deploy", entity: "deploy", element: <DeployResult /> },
  { path: "*", entity: "not-found", element: <NotFound /> },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {ROUTE_TABLE.map((entry) => (
          <Route key={entry.path} path={entry.path} element={entry.element} />
        ))}
      </Route>
    </Routes>
  );
}
