import { groupTasks, matchLevel, pointsForLevel, taskPoints } from "../lib/rubricTemplate";

const tone = (maxPct) =>
  maxPct < 0.5 ? "border-red-200 text-red-600 hover:bg-red-50" : maxPct < 0.8 ? "border-yellow-300 text-yellow-600 hover:bg-yellow-50" : "border-green-200 text-green-600 hover:bg-green-50";

/** Une tâche (question ou élément à noter): son propre encadré, ses points et ses niveaux. */
function TaskCard({ task, value, touched, canEdit, onChange }) {
  const earned = taskPoints(task, value);
  const max = Number(task.pts) || 0;
  const isFull = max > 0 && earned >= max;
  const step = max > 0 && max <= 2 ? 0.25 : 0.5;
  const shown = touched || earned > 0;
  const current = shown && task.levels?.length ? matchLevel(task.levels, max ? earned / max : 0) : null;
  const quick = [["0", 0], ["½", Number((max / 2).toFixed(2))], ["Max", max]];
  return (
    <div className={`rounded-lg border p-3.5 ${isFull ? "border-purple-300 bg-purple-50/50 dark:border-violet-500/40 dark:bg-violet-950/40" : earned > 0 ? "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-950/20" : "border-gray-200 bg-white dark:border-white/10 dark:bg-transparent"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${isFull ? "text-purple-800 dark:text-violet-200" : "text-gray-900 dark:text-slate-100"}`}>{task.label}</p>
        <div className="flex flex-shrink-0 items-center gap-1">
          {quick.map(([lbl, val]) => (
            <button key={lbl} type="button" disabled={!canEdit} onClick={() => onChange(val)} className={`rounded border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${earned === val && touched ? "border-purple-600 bg-purple-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-purple-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>{lbl}</button>
          ))}
          <input type="number" min={0} max={max} step={step} disabled={!canEdit} value={shown ? earned : ""} placeholder="0" onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-purple-400 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" aria-label={`Points pour ${task.label}`} />
          <span className="text-sm text-slate-600 dark:text-slate-300">/ {max}</span>
        </div>
      </div>
      {task.levels?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {task.levels.map((lvl, i) => (
            <button key={i} type="button" disabled={!canEdit} aria-pressed={current === lvl} onClick={() => onChange(pointsForLevel(task, lvl))} className={`rounded border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${tone(lvl.maxPct)} ${current === lvl ? "bg-blue-50/60 ring-2 ring-blue-400 ring-offset-1 dark:bg-white/10" : ""}`}>{lvl.label}</button>
          ))}
        </div>
      )}
      {current?.desc && <p className="mt-2 text-sm italic leading-snug text-gray-600 dark:text-slate-300">{current.desc}</p>}
      {earned < max && task.feedback && touched && (
        <p className="mt-2 rounded-md border border-red-200/80 bg-red-50/90 px-2.5 py-1.5 text-xs italic leading-snug text-red-700 dark:border-red-500/35 dark:bg-red-950/55 dark:text-red-200">⚠ {task.feedback}</p>
      )}
    </div>
  );
}

/** Tâches d'un critère, regroupées par bloc (étape) quand elles en ont un. */
export default function TaskGroups({ criterion, cid, subScores, touched, canEdit, onSubScore }) {
  return (
    <div className="space-y-4">
      {groupTasks(criterion.subCriteria).map((g, gi) => {
        const earned = g.tasks.reduce((s, t) => s + taskPoints(t, subScores[cid]?.[t.id]), 0);
        const max = g.tasks.reduce((s, t) => s + (Number(t.pts) || 0), 0);
        return (
          <section key={`${g.name}-${gi}`} className="space-y-2.5">
            {g.name && (
              <div className="flex items-baseline justify-between gap-3 border-b border-purple-200 pb-1 dark:border-violet-500/30">
                <h4 className="text-sm font-bold text-purple-800 dark:text-violet-200">{g.name}</h4>
                <span className="text-sm font-semibold text-purple-700 dark:text-violet-200">{Number(earned.toFixed(2))} / {Number(max.toFixed(2))} pts</span>
              </div>
            )}
            {g.tasks.map((t) => (
              <TaskCard key={t.id} task={t} value={subScores[cid]?.[t.id]} touched={touched[cid]?.[t.id]} canEdit={canEdit} onChange={(v) => onSubScore(cid, t.id, v, criterion)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
