import { Outlet, useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";
import { useSession } from "../lib/sessionState";

/** Section « Session en cours » : tout ce qui vit dans la session active. */
export default function SessionLayout() {
  const location = useLocation();
  const { active } = useSession();
  const sub = location.pathname.startsWith("/session/groupes") ? "groupes" : location.pathname.startsWith("/session/cours") ? "cours" : null;
  const tabParam = new URLSearchParams(location.search).get("tab");
  const activeEval = tabParam === "suivi" || tabParam === "envois" ? tabParam : "corriger";
  const tabs = [
    { id: "corriger", label: "Corriger", icon: "fa-pen-to-square", to: "/session?tab=corriger" },
    { id: "suivi", label: "Suivi d'évaluation", icon: "fa-list-check", to: "/session?tab=suivi" },
    { id: "envois", label: "Envois", icon: "fa-paper-plane", to: "/session?tab=envois" },
    { id: "cours", label: "Cours et évaluations", icon: "fa-book-open", to: "/session/cours" },
    { id: "groupes", label: "Groupes", icon: "fa-users", to: "/session/groupes" },
  ].map((t) => ({ ...t, active: sub ? t.id === sub : activeEval === t.id }));
  return (
    <div className="flex w-full flex-1 flex-col">
      <TabStrip tabs={tabs} label={active ? `Session en cours : ${active.name}` : "Session en cours"} />
      <Outlet />
    </div>
  );
}
