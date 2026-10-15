import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Cours et élèves d'un groupe de la session en cours. Les évaluations se choisissent par cours,
 * dans « Cours et évaluations » : un groupe reçoit celles de ses cours.
 */
export default function GroupResourcesPanel({ groupId, onChanged }) {
  const [group, setGroup] = useState(null);
  const [courses, setCourses] = useState([]);
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState("");
  const [pickStudent, setPickStudent] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, c, lib] = await Promise.all([api.getGroup(groupId), api.listCourses(), api.listLibraryStudents()]);
      setGroup(g);
      setCourses(c);
      setLibrary(lib);
      setError("");
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(fn) {
    setError("");
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const linkedIds = useMemo(() => new Set((group?.courses || []).map(String)), [group]);
  const enrolledIds = useMemo(() => new Set((group?.students || []).map((s) => String(s._id))), [group]);
  const freeCourses = courses.filter((c) => !linkedIds.has(String(c._id)));
  const outsiders = library.filter((s) => !enrolledIds.has(String(s._id)));

  if (!group) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const chip = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
  const sel = "rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800";

  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900/40">
      <h2 className="text-base font-bold">
        Cours et élèves de <span className="text-blue-600 dark:text-blue-400">{group.name}</span>
      </h2>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-gray-500">1. Cours du groupe</p>
          <div className="flex flex-wrap gap-1.5">
            {(group.courseList || []).map((c) => (
              <span key={c._id} className={`${chip} border-indigo-200 bg-indigo-50 text-indigo-800`}>
                {c.title}
                <button
                  type="button"
                  className="text-indigo-500 hover:text-red-600"
                  title="Retirer ce cours du groupe"
                  onClick={() => {
                    if (window.confirm(`Retirer « ${c.title} » du groupe ? Le groupe n'aura plus ses évaluations à corriger (les corrections déjà faites sont conservées).`))
                      act(() => api.updateGroup(groupId, { courses: (group.courses || []).filter((x) => String(x) !== String(c._id)) }));
                  }}
                >
                  <i className="fa-solid fa-xmark" aria-hidden />
                </button>
              </span>
            ))}
            {(group.courseList || []).length === 0 && <span className="text-xs text-gray-400">Aucun cours lié.</span>}
          </div>
          <p className="text-xs text-gray-500">Le groupe reçoit les évaluations choisies pour ses cours dans <Link to="/session/cours" className="font-semibold text-blue-600 underline">Cours et évaluations</Link>.</p>
          {freeCourses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {freeCourses.map((c) => (
                <button key={c._id} type="button" onClick={() => act(() => api.updateGroup(groupId, { courses: [...(group.courses || []), c._id] }))} className={`${chip} border-dashed border-gray-400 bg-white text-gray-700 hover:border-indigo-500 hover:bg-indigo-50`} title="Lier ce cours au groupe">
                  <i className="fa-solid fa-plus text-[0.8em]" aria-hidden /> {c.title}
                </button>
              ))}
            </div>
          ) : (
            courses.length === 0 && (
              <p className="text-xs text-gray-500">Crée d'abord un cours dans <Link to="/ressources/cours" className="font-semibold text-blue-600 underline">Ressources</Link>.</p>
            )
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-gray-500">2. Inscrire un élève existant</p>
          {outsiders.length > 0 ? (
            <div className="flex gap-1.5">
              <select className={`${sel} min-w-0 flex-1`} value={pickStudent} onChange={(e) => setPickStudent(e.target.value)}>
                <option value="">Choisir une fiche…</option>
                {outsiders.map((s) => (
                  <option key={s._id} value={s._id}>{s.lastName ? `${s.lastName}, ${s.firstName || ""}` : s.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!pickStudent}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                onClick={() => act(async () => { await api.enrollInGroup(groupId, { studentId: pickStudent }); setPickStudent(""); })}
              >
                Inscrire
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Toutes tes fiches sont déjà dans ce groupe. Pour une nouvelle personne, utilise « Ajouter » ci-dessous.</p>
          )}
          <p className="text-xs text-gray-500">Une fiche d'élève est permanente : elle te suit d'une session à l'autre.</p>
        </div>
      </div>
    </section>
  );
}
