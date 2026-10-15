import { Outlet, useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";

const TABS = [
  { id: "cours", label: "Cours", icon: "fa-book-open", to: "/ressources/cours" },
  { id: "grilles", label: "Grilles", icon: "fa-sliders", to: "/ressources/grilles" },
];

/** Section « Ressources » : cours et grilles, communs à toutes les sessions. */
export default function ResourcesLayout() {
  const { pathname } = useLocation();
  const tabs = TABS.map((t) => ({ ...t, active: pathname === t.to }));
  return (
    <div className="flex w-full flex-1 flex-col">
      <TabStrip tabs={tabs} label="Ressources" />
      <Outlet />
    </div>
  );
}
