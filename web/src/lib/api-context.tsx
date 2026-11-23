import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { RprintApi } from "./api";
import { FixtureApi } from "./fixture-api";

const ApiContext = createContext<RprintApi>(new FixtureApi());

export function ApiProvider({
  api,
  children,
}: {
  api?: RprintApi;
  children: ReactNode;
}) {
  const value = useMemo(() => api ?? new FixtureApi(), [api]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): RprintApi {
  return useContext(ApiContext);
}
