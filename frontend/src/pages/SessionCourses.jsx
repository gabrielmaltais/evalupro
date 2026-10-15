import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
import PageSectionTitle from "../components/PageSectionTitle";
import { Card, Chip, FormCard, btnDanger, btnPrimary, btnSecondary } from "../components/ui";

const input = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800";

/**
 * Ma session: les groupes de la session, ses cours, les évaluations cochées de chaque cours et les groupes qui
 * suivent chaque cours. C'est la seule source de ce qu'on peut corriger (onglet Corriger), suivre et envoyer.
 */
export default function SessionCourses() {
  const { active } = useSession();
  const sessionId = active?._id;
  const [entries, setEntries] = useState([]);
  const [library, setLibrary] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [allGroups, setAllGroups] = useState([]); // groupes communs, avec leur groupe de la session s'il y en a un
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(null); // cours choisi dans la bibliothèque
  const [checked, setChecked] = useState(new Set());
  const [draft, setDraft] = useState({ title: "", code: "" });

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [e, c, r, g] = await Promise.all([api.listSessionCourses(sessionId), api.listCourses(), api.listRubrics(), api.listCommonGroups()]);
      setEntries(e);
      setLibrary(c);
      setRubrics(r);
      setAllGroups(g);
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

  function toggleRubric(entry, rubric) {
    const rubricId = String(rubric._id);
    const ids = new Set(entry.rubrics.filter((r) => r.imported).map((r) => String(r._id)));
    if (ids.has(rubricId)) {
      if (rubric.correctedCount > 0 && !window.confirm(`« ${rubric.title} » a déjà ${rubric.correctedCount} copie(s) corrigée(s). La décocher la retire de Corriger ; les copies sont conservées et reviennent si tu la recoches. Continuer ?`)) return;
      ids.delete(rubricId);
    } else ids.add(rubricId);
    act(() => api.setSessionCourseRubrics(sessionId, entry.course._id, [...ids]));
  }

  const groups = allGroups.filter((x) => x.activeGroup);
  const readOnly = Boolean(active?.archivedAt);

  // Ajouter un groupe à la session, ou le retirer (archivé: ses élèves et ses corrections restent, on peut le remettre).
  function toggleSessionGroup(g) {
    if (!g.activeGroup) return act(() => api.createGroup({ name: g.name }));
    if (window.confirm(`Retirer « ${g.name} » de la session ? Ses élèves et ses corrections sont conservés ; tu pourras le remettre.`)) {
      act(() => api.archiveGroupById(g.activeGroup._id));
    }
  }

  const linked = (g, courseId) => (g.activeGroup?.courses || []).some((c) => String(c) === String(courseId));
  function toggleGroup(g, courseId) {
    const cur = g.activeGroup.courses || [];
    const courses = linked(g, courseId) ? cur.filter((c) => String(c) !== String(courseId)) : [...cur, courseId];
    act(() => api.updateGroup(g.activeGroup._id, { courses }));
  }

  if (!active) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="ui-info text-sm">Crée ou choisis d'abord une session dans <Link to="/ressources/sessions" className="font-semibold text-blue-600 underline">Sessions</Link>.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-book-open"
        iconBgClass="bg-emerald-600"
        title="Ma session"
        subtitle={`Session : ${active.name}. 1) Choisis tes groupes. 2) Ajoute tes cours et coche leurs évaluations. 3) Indique quels groupes suivent chaque cours. Les groupes et leurs élèves se gèrent dans Ressources.`}
        className="!mb-0"
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card title="Groupes de la session">
        {allGroups.length ? (
          <div className="flex flex-wrap gap-2">
            {allGroups.map((g) => (
              <Chip key={g._id} icon={g.activeGroup ? "fa-check" : "fa-plus"} active={Boolean(g.activeGroup)} onClick={() => !readOnly && toggleSessionGroup(g)}>
                {g.name}
              </Chip>
            ))}
          </div>
        ) : (
          <Link to="/ressources/groupes" className={`${btnSecondary} inline-block`}>Créer un groupe dans Ressources</Link>
        )}
        <p className="mt-2 text-xs text-gray-500">Un groupe ajouté amène ses élèves ; un groupe retiré garde ses élèves et ses corrections.</p>
      </Card>

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
        <button type="button" className={btnPrimary} onClick={() => setAdding(true)} disabled={readOnly}>
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
                        <input type="checkbox" checked={r.imported} disabled={readOnly} onChange={() => toggleRubric(entry, r)} />
                        {r.title}
                        {!r.isActive && <span className="text-xs text-gray-400">(inactive)</span>}
                        {r.correctedCount > 0 && <span className="text-xs font-semibold text-emerald-700">({r.correctedCount} copie{r.correctedCount > 1 ? "s" : ""} corrigée{r.correctedCount > 1 ? "s" : ""})</span>}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucune évaluation dans ce cours. <Link to="/ressources/grilles" className="text-blue-600 underline">En créer une</Link></p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Groupes qui suivent ce cours</p>
                {groups.length ? (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <Chip key={g._id} icon={linked(g, entry.course._id) ? "fa-check" : "fa-plus"} active={linked(g, entry.course._id)} onClick={() => !readOnly && toggleGroup(g, entry.course._id)}>
                        {g.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun groupe dans la session. Ajoute-en un plus haut.</p>
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
