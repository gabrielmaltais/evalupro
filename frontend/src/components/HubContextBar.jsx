import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
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
    const retired = ex?.retired ? " · retirée de la session" : "";
    if (course && evaluation && course !== evaluation) return `${course} — ${evaluation} (${version}${retired})`;
    return `${evaluation || course || "Examen"} (${version}${retired})`;
  }

  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api.listCourses().then(setCourses, () => setCourses([]));
  }, []);
  const courseTitle = (id) => courses.find((c) => String(c._id) === id)?.title || "Sans cours";
  const courseIds = [...new Set((examOptions || []).map((ex) => ex.courseId || ""))].sort((a, b) => courseTitle(a).localeCompare(courseTitle(b)));
  const examCourse = (examOptions || []).find((ex) => String(ex.rubricId) === String(selectedExamId || ""))?.courseId || "";

  // Parcours Groupe > Cours > Évaluation: on rouvre là où l'évaluation retenue se trouve.
  const [step, setStep] = useState(() => (selectedExamId ? 2 : 0));
  const [dir, setDir] = useState("next");
  const [courseId, setCourseId] = useState(examCourse);
  // L'évaluation retenue arrive parfois après le premier rendu (chargement): on suit son cours.
  const [seenExam, setSeenExam] = useState(selectedExamId);
  if (seenExam !== selectedExamId) {
    setSeenExam(selectedExamId);
    if (selectedExamId && examCourse) {
      setCourseId(examCourse);
      if (step === 0) setStep(2);
    }
  }
  if (step === 2 && !courseIds.includes(courseId) && courseIds.length) setStep(1);

  function go(next, direction, course) {
    setDir(direction);
    if (course !== undefined) setCourseId(course);
    setStep(next);
  }
  const back = () => go(step - 1, "back");
  function pickGroup(g) {
    setSelectedGroup(g);
    go(1, "next");
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-indigo-500/25 dark:from-slate-900/90 dark:to-indigo-950/70">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div key={step} className={`min-w-0 ${dir === "back" ? "hub-step-back" : "hub-step-next"}`}>
          {step > 0 && (
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <button type="button" onClick={back} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:text-blue-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" aria-label="Revenir en arrière" title="Revenir en arrière">
                <i className="fa-solid fa-arrow-left" aria-hidden />
              </button>
              <span className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {selectedGroup || "Tous les groupes"}
                {step === 2 && <span className="text-slate-400"> › {courseTitle(courseId)}</span>}
              </span>
            </div>
          )}
          {step === 0 && (
            <>
              <span className="ui-label">Groupe</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Groupe">
                <Chip active={!selectedGroup} onClick={() => pickGroup("")}>Tous les groupes</Chip>
                {groupKeys.map((g) => (
                  <Chip key={g} active={selectedGroup === g} onClick={() => pickGroup(g)} icon="fa-users">
                    {g}
                  </Chip>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <span className="ui-label">Cours</span>
              {courseIds.length === 0 ? (
                <Link to="/session/cours" className="text-xs font-medium text-blue-700 underline dark:text-blue-300">
                  Aucune évaluation disponible : coche-en dans « Ma session ».
                </Link>
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Cours">
                  {courseIds.map((id) => (
                    <Chip key={id || "sans-cours"} active={id === examCourse} onClick={() => go(2, "next", id)} icon="fa-book">
                      {courseTitle(id)}
                    </Chip>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <span className="ui-label">Évaluation</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Évaluation">
                {(examOptions || [])
                  .filter((ex) => (ex.courseId || "") === courseId)
                  .map((ex) => (
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
            </>
          )}
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
