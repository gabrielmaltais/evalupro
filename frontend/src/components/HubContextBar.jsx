export default function HubContextBar({ selectedGroup, setSelectedGroup, groupKeys, stats }) {
  const active = stats.find((s) => s.group === selectedGroup);
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-indigo-500/25 dark:from-slate-900/90 dark:to-indigo-950/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Groupe actif</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="eval-form-control rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-indigo-500/35"
          >
            <option value="">Tous les groupes</option>
            {groupKeys.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          {[
            ["Étudiants", active?.students ?? "-"],
            ["Évaluations", active?.evaluations ?? "-"],
            ["Moyenne", active ? `${active.avgPct}%` : "-"],
            ["Envois sent/failed", active ? `${active.sent}/${active.failed}` : "-"],
          ].map(([label, val]) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/50"
            >
              <div className="text-slate-500 dark:text-slate-400">{label}</div>
              <div className="font-bold text-slate-900 dark:text-slate-100">{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
