import { useEffect, useRef } from "react";

/**
 * Panneau d'édition (« Nouveau… », « Modifier… ») : titre lié à l'action, bouton de retour,
 * et à l'ouverture il remonte dans l'écran et place le curseur dans le premier champ.
 * `openKey` change à chaque ouverture (ex. id de la fiche ou "new") ; `autoFocus` pour les créations.
 */
export default function EditorPanel({ icon = "fa-pen", title, subtitle, onClose, closeLabel = "Retour à la liste", openKey, autoFocus = false, actions, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > window.innerHeight * 0.6) {
      el.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
    if (autoFocus) el.querySelector("input:not([type=checkbox]):not([type=radio]), textarea")?.focus({ preventScroll: true });
  }, [openKey, autoFocus]);

  return (
    <section ref={ref} className="ui-editor scroll-mt-24" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-700">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <i className={`fa-solid ${icon}`} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="ui-hint mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onClose && (
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              <i className="fa-solid fa-arrow-left" aria-hidden /> {closeLabel}
            </button>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
