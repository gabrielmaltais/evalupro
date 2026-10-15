import { Outlet, useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";

const TABS = [
  { id: "cours", label: "Cours", icon: "fa-book-open", to: "/ressources/cours" },
  { id: "grilles", label: "Évaluations", icon: "fa-sliders", to: "/ressources/grilles" },
  { id: "groupes", label: "Groupes et élèves", icon: "fa-users-between-lines", to: "/ressources/groupes" },
  { id: "sessions", label: "Sessions", icon: "fa-calendar-days", to: "/ressources/sessions" },
];

/** Section « Ressources » : cours, évaluations, groupes et sessions (avec leurs archives), communs à toutes les sessions. */
export default function ResourcesLayout() {
  const { pathname } = useLocation();
  // « Sessions » reste actif sur ses sous-pages (Archives).
  const tabs = TABS.map((t) => ({ ...t, active: pathname === t.to || pathname.startsWith(`${t.to}/`) }));
  return (
    <div className="flex w-full flex-1 flex-col">
      <TabStrip tabs={tabs} label="Ressources" />
      <Outlet />
    </div>
  );
}
