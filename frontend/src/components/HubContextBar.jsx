import MarkerBadge from "./MarkerBadge";

export default function HubContextBar({
  selectedGroup,
  setSelectedGroup,
  groupKeys,
  activeGroupStyle,
  selectedExamId,
  setSelectedExamId,
  examOptions,
  examGroupMarkers,
  stats,
}) {
  const selectedExam = (examOptions || []).find((ex) => String(ex.rubricId) === String(selectedExamId || ""));

  function examOptionLabel(ex) {
    const course = String(ex?.title || "").trim();
    const evaluation = String(ex?.taskTitle || "").trim();
    const version = `v${ex?.version ?? 1}`;
    if (course && evaluation && course !== evaluation) return `${course} — ${evaluation} (${version})`;
    return `${evaluation || course || "Examen"} (${version})`;
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-indigo-500/25 dark:from-slate-900/90 dark:to-indigo-950/70">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Groupe actif</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="eval-form-control w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-indigo-500/35"
            >
              <option value="">Tous les groupes</option>
              {groupKeys.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {selectedGroup && (activeGroupStyle?.color || activeGroupStyle?.icon) ? (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-500 dark:text-slate-500">Repère groupe :</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-white/90 px-2 py-0.5 dark:border-indigo-500/25 dark:bg-slate-900/50">
                  <MarkerBadge color={activeGroupStyle?.color} icon={activeGroupStyle?.icon} size="md" />
                </span>
              </div>
            ) : null}
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Examen</span>
            <select
              value={selectedExamId || ""}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="eval-form-control w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-indigo-500/35"
            >
              <option value="">— Choisir un examen —</option>
              {(examOptions || []).map((ex) => (
                <option key={`hub-exam-${ex.rubricId}-${ex.version ?? 1}`} value={String(ex.rubricId)}>
                  {examOptionLabel(ex)}
                </option>
              ))}
            </select>
            {selectedExam && (
              <div
                className="mt-1 min-w-0 rounded-md border border-blue-100/80 bg-white/75 px-2 py-1 text-xs leading-snug text-slate-600 dark:border-indigo-400/20 dark:bg-slate-900/40 dark:text-slate-300"
                title={examOptionLabel(selectedExam)}
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedExam.title || selectedExam.taskTitle || "Cours"}</span>
                {selectedExam.title && selectedExam.taskTitle && selectedExam.title !== selectedExam.taskTitle ? (
                  <span className="truncate"> — {selectedExam.taskTitle}</span>
                ) : null}
              </div>
            )}
            <div className="mt-2 max-h-24 overflow-auto rounded-md border border-blue-100/70 bg-white/80 px-2 py-1 dark:border-indigo-400/20 dark:bg-slate-900/45">
              {(examOptions || []).length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Aucune grille disponible.</p>
              ) : (
                <ul className="space-y-1">
                  {(examOptions || []).map((ex) => {
                    const rid = String(ex.rubricId || "");
                    const markers = (examGroupMarkers && examGroupMarkers[rid]) || [];
                    return (
                      <li key={`exam-marker-${rid}`} className="flex items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedExamId(rid)}
                          className={`truncate text-left ${
                            String(selectedExamId || "") === rid
                              ? "font-semibold text-blue-700 dark:text-blue-300"
                              : "text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
                          }`}
                          title={examOptionLabel(ex)}
                        >
                          {ex.taskTitle || ex.title || "Examen"}
                        </button>
                        <span className="inline-flex items-center gap-1">
                          {markers.slice(0, 4).map((m, idx) => (
                            <MarkerBadge key={`${rid}-m-${idx}`} color={m.color} icon={m.icon} />
                          ))}
                          {markers.length > 4 ? <span className="text-[10px] text-slate-400">+{markers.length - 4}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:w-[420px]">
          {[
            ["Étudiants", stats?.students ?? "-"],
            ["Copies corrigées", stats?.correctedLabel ?? "-"],
            ["Moyenne", stats?.avgPct != null ? `${stats.avgPct}%` : "-"],
            ["Envois sent/failed", stats?.sentFailed ?? "-"],
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
