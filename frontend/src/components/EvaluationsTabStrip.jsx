import { Link, useLocation } from "react-router-dom";

const TABS = [
  { id: "corriger", label: "Corriger", icon: "fa-pen-to-square", to: "/evaluations?tab=corriger" },
  { id: "suivi", label: "Suivi d'évaluation", icon: "fa-list-check", to: "/evaluations?tab=suivi" },
  { id: "envois", label: "Envois", icon: "fa-paper-plane", to: "/evaluations?tab=envois" },
  { id: "grilles", label: "Grilles", icon: "fa-sliders", to: "/evaluations/grilles" },
];

/** Une seule rangée d’onglets : correction, suivi, envois, grilles (évite deux barres superposées). */
export default function EvaluationsTabStrip() {
  const location = useLocation();
  const isGrilles = location.pathname === "/evaluations/grilles";
  const tabParam = new URLSearchParams(location.search).get("tab");
  const activeEval =
    tabParam === "suivi" || tabParam === "envois" || tabParam === "corriger" ? tabParam : "corriger";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav
        className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 sm:grid-cols-4"
        aria-label="Évaluations"
      >
        {TABS.map((t) => {
          const active = t.id === "grilles" ? isGrilles : !isGrilles && activeEval === t.id;
          return (
            <Link
              key={t.id}
              to={t.to}
              className={`flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-center text-sm font-medium transition-all sm:px-3 ${
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
