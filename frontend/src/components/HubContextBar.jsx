import { Link } from "react-router-dom";
import { Chip } from "./ui";

export default function HubContextBar({
  selectedGroup,
  setSelectedGroup,
  groupKeys,
  selectedExamId,
  setSelectedExamId,
  examOptions,
  stats,
}) {
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
        <div className="space-y-3">
          <div>
            <span className="ui-label">1. Groupe</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Groupe">
              <Chip active={!selectedGroup} onClick={() => setSelectedGroup("")}>Tous les groupes</Chip>
              {groupKeys.map((g) => (
                <Chip key={g} active={selectedGroup === g} onClick={() => setSelectedGroup(g)} icon="fa-users">
                  {g}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <span className="ui-label">2. Examen à évaluer</span>
            {(examOptions || []).length === 0 ? (
              <Link to="/session/groupes" className="text-xs font-medium text-blue-700 underline dark:text-blue-300">
                Aucune évaluation disponible : choisis-en dans « Cours et évaluations ».
              </Link>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Examen">
                {(examOptions || []).map((ex) => (
                  <Chip
                    key={`hub-exam-${ex.rubricId}-${ex.version ?? 1}`}
                    active={String(selectedExamId || "") === String(ex.rubricId)}
                    onClick={() => setSelectedExamId(String(selectedExamId || "") === String(ex.rubricId) ? "" : String(ex.rubricId))}
                    icon="fa-file-pen"
                  >
                    {examOptionLabel(ex)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
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
