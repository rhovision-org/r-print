import { HashRouter } from "react-router-dom";
import { ApiProvider } from "./lib/api-context";
import { AppRoutes } from "./routes";

export function App() {
  return (
    <ApiProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ApiProvider>
  );
}
