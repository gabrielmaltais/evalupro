import { markerIconClasses, MARKER_ICON_PRESET_OPTIONS } from "../lib/markerPresets";

export default function MarkerBadge({ color, icon, size = "sm", className = "" }) {
  const c = String(color || "").trim();
  const ic = String(icon || "").trim();
  if (!c && !ic) return null;
  const dotSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const iconCls = size === "md" ? "text-sm" : "text-xs";
  const iclasses = markerIconClasses(ic);
  const spanCls = "inline-flex items-center gap-1 shrink-0 " + className;
  const iCls = iclasses + " " + iconCls + " text-slate-700 dark:text-slate-200";
  const dotCls =
    "inline-block rounded-full border border-black/15 dark:border-white/20 " + dotSize;
  return (
    <span className={spanCls} title={c || ic || undefined}>
      {iclasses ? <i className={iCls} aria-hidden /> : null}
      {c ? <span className={dotCls} style={{ backgroundColor: c }} /> : null}
    </span>
  );
}

export function MarkerStyleControls({ color, icon, onChange, disabled = false, idPrefix = "marker" }) {
  const safeColor = String(color || "").trim();
  const pickerVal = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(safeColor) ? safeColor : "#94a3b8";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block min-w-0">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Icône (optionnel)
        </span>
        <select
          id={idPrefix + "-icon"}
          disabled={disabled}
          className="eval-form-control w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={icon || ""}
          onChange={(e) => onChange({ icon: e.target.value })}
        >
          {MARKER_ICON_PRESET_OPTIONS.map((o) => (
            <option key={o.value || "__none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-0">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Couleur (optionnel)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={idPrefix + "-color-pick"}
            type="color"
            disabled={disabled}
            className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
            value={pickerVal}
            onChange={(e) => onChange({ color: e.target.value })}
          />
          <input
            id={idPrefix + "-color-hex"}
            type="text"
            disabled={disabled}
            placeholder="#3366cc"
            className="eval-form-control min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={safeColor}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">Aperçu :</span>
        <MarkerBadge color={safeColor} icon={icon} size="md" />
        <button
          type="button"
          disabled={disabled || (!safeColor && !icon)}
          className="ml-auto text-xs font-medium text-slate-600 underline decoration-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
          onClick={() => onChange({ color: "", icon: "" })}
        >
          Effacer le repère
        </button>
      </div>
    </div>
  );
}