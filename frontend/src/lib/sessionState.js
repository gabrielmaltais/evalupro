import { createContext, useContext } from "react";

export const SessionContext = createContext({
  sessions: [],
  active: null,
  loading: true,
  switchTo: async () => {},
  reload: async () => {},
});

/** Session en cours + liste des sessions ouvertes (fournies par SessionProvider). */
export function useSession() {
  return useContext(SessionContext);
}
