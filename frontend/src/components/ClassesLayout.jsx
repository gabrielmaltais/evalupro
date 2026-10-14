import { Outlet, useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";

const TABS = [
  { id: "cours", label: "Cours", icon: "fa-book-open", to: "/classes/cours" },
  { id: "groupes", label: "Groupes et élèves", icon: "fa-users-between-lines", to: "/classes/groupes" },
  { id: "sessions", label: "Sessions", icon: "fa-calendar-days", to: "/classes/sessions" },
  { id: "archives", label: "Archives", icon: "fa-box-archive", to: "/classes/archives" },
];

/** Section « Cours et groupes » : cours, groupes, élèves et sessions (le cadre de l'année), puis la page active. */
export default function ClassesLayout() {
  const { pathname } = useLocation();
  const tabs = TABS.map((t) => ({ ...t, active: pathname === t.to }));
  return (
    <div className="flex w-full flex-1 flex-col">
      <TabStrip tabs={tabs} label="Cours et groupes" />
      <Outlet />
    </div>
  );
}
