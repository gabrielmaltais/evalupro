import { Link, Outlet, useLocation } from "react-router-dom";
import { Chip } from "./ui";

const TABS = [
  { id: "sessions", label: "Sessions", icon: "fa-calendar-days", to: "/ressources/sessions" },
  { id: "archives", label: "Archives", icon: "fa-box-archive", to: "/ressources/sessions/archives" },
];

/** Sous-section de Ressources › Sessions : créer, copier, archiver et restaurer (Sessions / Archives). */
export default function SessionsLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 pt-4 sm:px-6 lg:px-8" role="tablist" aria-label="Sessions">
        {TABS.map((t) => (
          <Link key={t.id} to={t.to} role="tab" aria-selected={pathname === t.to} className="no-underline">
            <Chip active={pathname === t.to} icon={t.icon}>{t.label}</Chip>
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
