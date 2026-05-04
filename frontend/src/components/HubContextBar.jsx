export default function HubContextBar({
  selectedGroup,
  setSelectedGroup,
  groupKeys,
  selectedExamId,
  setSelectedExamId,
  examOptions,
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
                className="mt-2.5 min-w-0 border-l-[3px] border-indigo-500/80 pl-3 dark:border-indigo-400/70"
                title={examOptionLabel(selectedExam)}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Examen sélectionné
                </span>
                {(() => {
                  const course = String(selectedExam.title || "").trim();
                  const task = String(selectedExam.taskTitle || "").trim();
                  const same = course && task && course.toLowerCase() === task.toLowerCase();
                  if (course && task && !same) {
                    return (
                      <>
                        <p className="mt-1 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{course}</p>
                        <p className="mt-1 text-xs font-normal leading-snug text-slate-600 dark:text-slate-400">{task}</p>
                      </>
                    );
                  }
                  return (
                    <p className="mt-1 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                      {course || task || "Examen"}
                    </p>
                  );
                })()}
              </div>
            )}
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
