import { Outlet, useLocation } from "react-router-dom";
import TabStrip from "./TabStrip";

const TABS = [
  { id: "sessions", label: "Sessions", icon: "fa-calendar-days", to: "/sessions" },
  { id: "archives", label: "Archives", icon: "fa-box-archive", to: "/sessions/archives" },
];

/** Section « Sessions » : créer, copier, archiver et restaurer. */
export default function SessionsLayout() {
  const { pathname } = useLocation();
  const tabs = TABS.map((t) => ({ ...t, active: pathname === t.to }));
  return (
    <div className="flex w-full flex-1 flex-col">
      <TabStrip tabs={tabs} label="Sessions" />
      <Outlet />
    </div>
  );
}
