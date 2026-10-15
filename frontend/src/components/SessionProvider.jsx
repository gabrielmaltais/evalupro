import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { SessionContext } from "../lib/sessionState";

/** Charge les sessions et la session active; `switchTo` change de session de travail. */
export default function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [list, cur] = await Promise.all([api.listSessions(), api.getActiveSession()]);
      setSessions(Array.isArray(list) ? list : []);
      setActive(cur?.session ?? null);
    } catch {
      setSessions([]);
      setActive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const switchTo = useCallback(
    async (sessionId) => {
      await api.setActiveSession(sessionId);
      await reload();
    },
    [reload],
  );

  const value = useMemo(() => ({ sessions, active, loading, switchTo, reload }), [sessions, active, loading, switchTo, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
