import { Link } from "react-router-dom";

/** Rangée d'onglets commune (défilante sur téléphone, en grille sur écran large). */
export default function TabStrip({ tabs, label }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav
        className="-mx-1 flex snap-x gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm [scrollbar-width:none] dark:border-gray-700/60 dark:bg-gray-900/40 sm:mx-0 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        aria-label={label}
      >
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            ref={(el) => {
              if (t.active && el?.scrollIntoView) el.scrollIntoView({ inline: "center", block: "nearest" });
            }}
            aria-current={t.active ? "page" : undefined}
            className={`flex min-h-[2.75rem] shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-all sm:flex-1 sm:px-3 ${
              t.active
                ? "border-blue-600 bg-blue-600 text-white shadow"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-200 dark:hover:bg-gray-800/70"
            }`}
          >
            <i className={`fa-solid ${t.icon} shrink-0 text-[0.85em]`} aria-hidden />
            <span className="leading-tight">{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
