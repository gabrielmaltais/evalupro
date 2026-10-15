/** Briques de la charte graphique (styles dans index.css, section « CHARTE GRAPHIQUE »). */

/** Carte d'information: bandeau de titre gris, contenu blanc. */
export function Card({ title, actions, children, className = "", bodyClassName = "ui-card-body" }) {
  return (
    <section className={`ui-card ${className}`}>
      {(title || actions) && (
        <div className="ui-card-head">
          <h2 className="flex items-center gap-2">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2 normal-case tracking-normal">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * Carte de création / modification: bandeau coloré, pastille de mode (Nouveau, Modification…),
 * titre qui dit ce qu'on fait, et bouton de retour (obligatoire pour qu'on sache comment en sortir).
 */
export function FormCard({ mode, title, accent = "#2563eb", onBack, backLabel = "Retour", children, className = "" }) {
  return (
    <section className={`ui-card ui-form ${className}`} style={{ "--ui-accent": accent }}>
      <div className="ui-card-head">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="ui-mode">{mode}</span>
          <h2 className="min-w-0 truncate">{title}</h2>
        </div>
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <i className="fa-solid fa-arrow-left mr-1" aria-hidden /> {backLabel}
          </button>
        )}
      </div>
      <div className="ui-card-body space-y-4">{children}</div>
    </section>
  );
}

/** Pastille de choix: un clic sélectionne, l'état actif est bien visible. Remplace les longues listes déroulantes. */
export function Chip({ active, onClick, icon, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[2.25rem] items-center gap-2 rounded-xl border px-3.5 py-1.5 text-left text-sm font-medium transition ${
        active
          ? "border-blue-600 bg-blue-600 text-white shadow"
          : "border-gray-300 bg-white text-gray-800 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
      } ${className}`}
    >
      {icon && <i className={`fa-solid ${icon} text-[0.8em] opacity-80`} aria-hidden />}
      <span>{children}</span>
    </button>
  );
}

export const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60";
export const btnSecondary = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";
export const btnDanger = "rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50";
