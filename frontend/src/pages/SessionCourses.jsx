import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
import PageSectionTitle from "../components/PageSectionTitle";
import { Card, Chip, FormCard, btnDanger, btnPrimary, btnSecondary } from "../components/ui";

const input = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800";

/**
 * Cours de la session en cours: on choisit les cours, on les lie aux groupes et on coche les évaluations
 * importées. Ce qui est coché ici est ce qu'on peut corriger (onglet Corriger).
 */
export default function SessionCourses() {
  const { active } = useSession();
  const sessionId = active?._id;
  const [entries, setEntries] = useState([]);
  const [library, setLibrary] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(null); // cours choisi dans la bibliothèque
  const [checked, setChecked] = useState(new Set());
  const [draft, setDraft] = useState({ title: "", code: "" });

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [e, c, r, g] = await Promise.all([api.listSessionCourses(sessionId), api.listCourses(), api.listRubrics(), api.listGroups()]);
      setEntries(e);
      setLibrary(c);
      setRubrics(r);
      setGroups(g);
      setError("");
    } catch (err) {
      setError(String(err.message || err));
    }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(fn) {
    setError("");
    try {
      const out = await fn();
      if (Array.isArray(out)) setEntries(out);
      await load();
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  const inSession = new Set(entries.map((e) => String(e.course._id)));
  const freeCourses = library.filter((c) => !inSession.has(String(c._id)) && !c.archivedAt);
  const rubricsOf = (courseId) => rubrics.filter((r) => String(r.course) === String(courseId));

  function choose(course) {
    setPick(course);
    setChecked(new Set(rubricsOf(course._id).filter((r) => r.isActive).map((r) => String(r._id))));
  }

  function closeAdd() {
    setAdding(false);
    setPick(null);
    setDraft({ title: "", code: "" });
  }

  async function addPicked() {
    await act(() => api.addSessionCourse(sessionId, pick._id, [...checked]));
    closeAdd();
  }

  // Le cours créé ici va aussi dans Ressources > Cours (c'est le même cours).
  async function createAndAdd() {
    if (!draft.title.trim()) return setError("Le nom du cours est requis.");
    await act(async () => {
      const course = await api.createCourse({ title: draft.title.trim(), code: draft.code.trim() });
      return api.addSessionCourse(sessionId, course._id, []);
    });
    closeAdd();
  }

  function toggleRubric(entry, rubricId) {
    const ids = new Set(entry.rubrics.filter((r) => r.imported).map((r) => String(r._id)));
    if (ids.has(rubricId)) ids.delete(rubricId);
    else ids.add(rubricId);
    act(() => api.setSessionCourseRubrics(sessionId, entry.course._id, [...ids]));
  }

  function toggleGroup(group, courseId) {
    const has = (group.courses || []).some((c) => String(c) === String(courseId));
    const courses = has ? group.courses.filter((c) => String(c) !== String(courseId)) : [...(group.courses || []), courseId];
    act(() => api.updateGroup(group._id, { courses }));
  }

  if (!active) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="ui-info text-sm">Crée ou choisis d'abord une session dans <Link to="/sessions" className="font-semibold text-blue-600 underline">Sessions</Link>.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-book-open"
        iconBgClass="bg-emerald-600"
        title="Cours et évaluations"
        subtitle={`Session : ${active.name}. Choisis les cours de la session, lie-les aux groupes et coche les évaluations à corriger.`}
        className="!mb-0"
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {adding ? (
        <FormCard mode="Ajout" title={pick ? `Évaluations de « ${pick.title} »` : "Ajouter un cours à la session"} accent="#059669" onBack={pick ? () => setPick(null) : closeAdd} backLabel={pick ? "Autre cours" : "Annuler"}>
          {pick ? (
            <>
              {rubricsOf(pick._id).length === 0 ? (
                <p className="ui-info text-sm">Ce cours n'a encore aucune évaluation. Tu pourras en créer dans <Link to="/ressources/grilles" className="font-semibold text-blue-600 underline">Ressources</Link>.</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Les évaluations actives sont cochées. Décoche celles que tu ne veux pas corriger cette session.</p>
                  {rubricsOf(pick._id).map((r) => (
                    <label key={r._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked.has(String(r._id))}
                        onChange={() => {
                          const next = new Set(checked);
                          if (next.has(String(r._id))) next.delete(String(r._id));
                          else next.add(String(r._id));
                          setChecked(next);
                        }}
                      />
                      {r.title}
                      {!r.isActive && <span className="text-xs text-gray-400">(inactive)</span>}
                    </label>
                  ))}
                </div>
              )}
              <button type="button" className={btnPrimary} onClick={addPicked}>
                Ajouter le cours ({checked.size} évaluation{checked.size > 1 ? "s" : ""})
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Depuis mes cours</p>
                {freeCourses.length ? (
                  <div className="flex flex-wrap gap-2">
                    {freeCourses.map((c) => (
                      <Chip key={c._id} icon="fa-plus" onClick={() => choose(c)}>
                        {c.title}
                        {c.code && <span className="ml-1 opacity-60">{c.code}</span>}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Tous tes cours sont déjà dans la session.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Ou un nouveau cours</p>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                  <input className={input} placeholder="Nom du cours" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <input className={input} placeholder="Code (facultatif)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                  <button type="button" className={btnPrimary} onClick={createAndAdd}>Créer et ajouter</button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Le cours est aussi rangé dans Ressources › Cours.</p>
              </div>
            </>
          )}
        </FormCard>
      ) : (
        <button type="button" className={btnPrimary} onClick={() => setAdding(true)} disabled={Boolean(active.archivedAt)}>
          <i className="fa-solid fa-plus mr-1" aria-hidden /> Ajouter un cours
        </button>
      )}

      {entries.length === 0 && <p className="ui-info text-sm">Aucun cours dans cette session pour l'instant.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {entries.map((entry) => (
          <Card
            key={entry.course._id}
            title={<><i className="fa-solid fa-book text-emerald-600" aria-hidden /> {entry.course.title}{entry.course.code && <span className="font-normal normal-case text-gray-400"> · {entry.course.code}</span>}</>}
            actions={
              <button
                type="button"
                className={`${btnDanger} !px-2 !py-1 text-xs`}
                onClick={() => {
                  if (window.confirm(`Retirer « ${entry.course.title} » de la session ? Ses groupes ne pourront plus corriger ses évaluations (les corrections déjà faites sont conservées).`))
                    act(() => api.removeSessionCourse(sessionId, entry.course._id));
                }}
              >
                Retirer
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Évaluations importées</p>
                {entry.rubrics.length ? (
                  <div className="space-y-1.5">
                    {entry.rubrics.map((r) => (
                      <label key={r._id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={r.imported} onChange={() => toggleRubric(entry, String(r._id))} />
                        {r.title}
                        {!r.isActive && <span className="text-xs text-gray-400">(inactive)</span>}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucune évaluation dans ce cours. <Link to="/ressources/grilles" className="text-blue-600 underline">En créer une</Link></p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Groupes</p>
                {groups.length ? (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <Chip key={g._id} active={(g.courses || []).some((c) => String(c) === String(entry.course._id))} onClick={() => toggleGroup(g, entry.course._id)}>
                        {g.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun groupe. <Link to="/session/groupes" className="text-blue-600 underline">Créer un groupe</Link></p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Link to="/session?tab=corriger" className={`${btnSecondary} inline-block`}>Aller corriger</Link>
    </main>
  );
}
