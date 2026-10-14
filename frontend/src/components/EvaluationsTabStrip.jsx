import { Link, useLocation } from "react-router-dom";

const TABS = [
  { id: "corriger", label: "Corriger", icon: "fa-pen-to-square", to: "/evaluations?tab=corriger" },
  { id: "suivi", label: "Suivi d'évaluation", icon: "fa-list-check", to: "/evaluations?tab=suivi" },
  { id: "envois", label: "Envois", icon: "fa-paper-plane", to: "/evaluations?tab=envois" },
  { id: "cours", label: "Cours", icon: "fa-book-open", to: "/evaluations/cours" },
  { id: "sessions", label: "Sessions", icon: "fa-box-archive", to: "/evaluations/sessions" },
  { id: "grilles", label: "Grilles", icon: "fa-sliders", to: "/evaluations/grilles" },
];

/** Une seule rangée d’onglets : correction, suivi, envois, grilles (évite deux barres superposées). */
export default function EvaluationsTabStrip() {
  const location = useLocation();
  const isGrilles = location.pathname === "/evaluations/grilles";
  const isCours = location.pathname === "/evaluations/cours";
  const isSessions = location.pathname === "/evaluations/sessions";
  const tabParam = new URLSearchParams(location.search).get("tab");
  const activeEval =
    tabParam === "suivi" || tabParam === "envois" || tabParam === "corriger" ? tabParam : "corriger";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav
        className="-mx-1 flex snap-x gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm [scrollbar-width:none] dark:border-gray-700/60 dark:bg-gray-900/40 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        aria-label="Évaluations"
      >
        {TABS.map((t) => {
          const active =
            t.id === "grilles" ? isGrilles : t.id === "cours" ? isCours : t.id === "sessions" ? isSessions : !isGrilles && !isCours && !isSessions && activeEval === t.id;
          return (
            <Link
              key={t.id}
              ref={(el) => {
                if (active && el?.scrollIntoView) el.scrollIntoView({ inline: "center", block: "nearest" });
              }}
              to={t.to}
              className={`flex min-h-[2.75rem] shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-all sm:px-3 ${
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-200 dark:hover:bg-gray-800/70"
              }`}
            >
              <i className={`fa-solid ${t.icon} shrink-0 text-[0.85em]`} aria-hidden />
              <span className="leading-tight">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
