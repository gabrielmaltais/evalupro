import { Link, NavLink, Outlet } from "react-router-dom";
import SessionProvider from "./SessionProvider";
import { useSession } from "../lib/sessionState";
import DarkToggle from "./DarkToggle";
import { getUserFromToken } from "../lib/api";

function SessionSwitcher() {
  const { sessions, active, switchTo } = useSession();
  const open = sessions.filter((s) => !s.archivedAt);
  if (open.length === 0) return null;
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <i className="fa-solid fa-calendar-check hidden sm:inline" aria-hidden />
      <span className="sr-only">Session de travail</span>
      <select
        value={active?._id || ""}
        onChange={(e) => switchTo(e.target.value || null)}
        className="max-w-[5.5rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:max-w-[14rem]"
        title="Session de travail"
      >
        {open.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const iconBtn =
  "flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9 text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

/** Raccourcis en icônes (Administration, thème, déconnexion) et avatar pour « Mon compte », en haut à droite. */
function HeaderActions() {
  const user = getUserFromToken();
  const initials =
    String(user?.name || user?.email || "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      {/* Raccourci vers l'action principale du site. */}
      <Link
        to="/ressources/grilles?new=1"
        title="Nouvelle évaluation"
        aria-label="Nouvelle évaluation"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 sm:h-9 sm:px-3"
      >
        <i className="fa-solid fa-plus" aria-hidden />
        <span className="hidden sm:inline">Évaluation</span>
      </Link>
      <SessionSwitcher />
      <div className="flex items-center gap-0.5 rounded-2xl bg-gray-100/90 p-1 ring-1 ring-gray-200/60 dark:bg-gray-800/80 dark:ring-gray-700/60">
        {user?.role === "admin" && (
          <NavLink
            to="/admin/users"
            title="Administration"
            aria-label="Administration"
            className={({ isActive }) => `${iconBtn} ${isActive ? "!bg-white !text-blue-600 shadow-sm ring-1 ring-gray-200/80 dark:!bg-gray-700 dark:!text-blue-300 dark:ring-gray-600" : ""}`}
          >
            <i className="fa-solid fa-screwdriver-wrench text-sm" aria-hidden />
          </NavLink>
        )}
        <DarkToggle className="!h-8 !w-8 sm:!h-9 sm:!w-9 !bg-transparent hover:!bg-white hover:shadow-sm dark:hover:!bg-gray-700" />
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("eval_token");
            window.location.href = "/login";
          }}
          className={`${iconBtn} hover:!text-red-600 dark:hover:!text-red-400`}
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <i className="fa-solid fa-right-from-bracket text-sm" aria-hidden />
        </button>
      </div>
      <NavLink
        to="/account"
        title={user?.name ? `Mon compte — ${user.name}` : "Mon compte"}
        aria-label="Mon compte"
        className={({ isActive }) =>
          `flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold sm:h-9 sm:w-9 sm:text-sm text-white shadow-md shadow-blue-600/20 transition hover:shadow-lg ${
            isActive ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-950" : ""
          }`
        }
      >
        {initials}
      </NavLink>
    </div>
  );
}

function AppNav() {
  const links = [
    { to: "/session", label: "Session en cours", icon: "fa-graduation-cap", end: false },
    { to: "/ressources", label: "Ressources", icon: "fa-book-open", end: false },
  ];

  return (
    <nav className="flex min-w-0 justify-center" aria-label="Navigation principale">
      <div className="grid w-full grid-cols-2 gap-0.5 rounded-2xl bg-gray-100/90 p-1 shadow-inner ring-1 ring-gray-200/60 dark:bg-gray-800/80 dark:ring-gray-700/60 sm:gap-1 lg:flex lg:w-auto lg:items-center">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end !== false}
            className={({ isActive }) =>
              [
                "flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-200 sm:px-3.5 sm:text-sm lg:shrink-0",
                isActive
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-700 dark:text-blue-300 dark:ring-gray-600"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-100",
              ].join(" ")
            }
          >
            <i className={`fa-solid ${l.icon} text-[0.85em] opacity-90`} aria-hidden />
            <span className="truncate">{l.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function ShellBody() {
  const { active } = useSession();
  return (
    <div className="min-h-screen flex flex-col bg-slate-200 text-gray-800 font-sans dark:bg-gray-950 dark:text-gray-100 dm-bg">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        {/* Une seule rangée sur grand écran (logo | menu | actions); sur petit écran le menu passe dessous, sur toute la largeur. */}
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3 lg:grid-cols-[auto_1fr_auto] lg:gap-x-6 lg:px-8">
          <Link
            to="/session"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl outline-none ring-blue-500/0 transition focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/20 transition group-hover:shadow-lg group-hover:shadow-blue-600/25 sm:h-10 sm:w-10">
              <i className="fa-solid fa-graduation-cap text-lg" aria-hidden />
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-gray-900 min-[420px]:inline dark:text-white">ÉvaluPro</span>
          </Link>

          <div className="flex min-w-0 justify-end lg:order-3">
            <HeaderActions />
          </div>

          <div className="col-span-2 min-w-0 lg:order-2 lg:col-span-1">
            <AppNav />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        <Outlet key={active?._id || "none"} />
      </div>
    </div>
  );
}

export default function MainLayout() {
  return (
    <SessionProvider>
      <ShellBody />
    </SessionProvider>
  );
}
