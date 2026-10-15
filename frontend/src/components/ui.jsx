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

export const btnPrimary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60";
export const btnSecondary = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";
export const btnDanger = "rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50";
