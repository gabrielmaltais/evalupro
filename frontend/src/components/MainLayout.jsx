import { Link, NavLink, Outlet } from "react-router-dom";
import DarkToggle from "./DarkToggle";
import { getUserFromToken } from "../lib/api";

function HeaderActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <DarkToggle />
      <button
        type="button"
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("eval_token");
          window.location.href = "/login";
        }}
        className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors"
        title="Se déconnecter"
      >
        <i className="fa-solid fa-right-from-bracket text-sm sm:text-base" />
      </button>
    </div>
  );
}

function AppNav() {
  const role = getUserFromToken()?.role;
  const links = [
    { to: "/evaluations", label: "Évaluations", icon: "fa-graduation-cap", end: false },
    { to: "/admin/students", label: "Élèves et groupes", icon: "fa-users-between-lines", end: true },
    { to: "/account", label: "Mon compte", icon: "fa-user-gear", end: true },
  ];
  if (role === "admin") {
    links.push({ to: "/admin/users", label: "Administration", icon: "fa-screwdriver-wrench", end: true });
  }

  return (
    <nav
      className="flex min-w-0 flex-1 justify-center lg:justify-center px-0 sm:px-2"
      aria-label="Navigation principale"
    >
      <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl bg-gray-100/90 p-1 py-0.5 shadow-inner [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:gap-1 dark:bg-gray-800/80 dark:ring-gray-700/60 [&::-webkit-scrollbar]:hidden sm:[scrollbar-width:auto] ring-1 ring-gray-200/60">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end !== false}
            className={({ isActive }) =>
              [
                "flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-200 sm:px-3.5 sm:py-2 sm:text-sm",
                isActive
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-700 dark:text-blue-300 dark:ring-gray-600"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-100",
              ].join(" ")
            }
          >
            <i className={`fa-solid ${l.icon} text-[0.85em] opacity-90`} aria-hidden />
            <span className="whitespace-nowrap">{l.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-800 font-sans dark:bg-gray-950 dark:text-gray-100 dm-bg">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:px-6 sm:py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-8">
          <div className="flex items-center justify-between gap-3 lg:min-w-[10rem] lg:justify-start lg:shrink-0">
            <Link
              to="/evaluations"
              className="group flex items-center gap-2.5 rounded-xl outline-none ring-blue-500/0 transition focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/20 transition group-hover:shadow-lg group-hover:shadow-blue-600/25">
                <i className="fa-solid fa-graduation-cap text-lg" aria-hidden />
              </span>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">ÉvaluPro</span>
            </Link>
            <div className="flex items-center lg:hidden">
              <HeaderActions />
            </div>
          </div>

          <AppNav />

          <div className="hidden items-center justify-end lg:flex lg:min-w-[10rem] lg:shrink-0">
            <HeaderActions />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
