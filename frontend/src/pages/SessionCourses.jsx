import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
import PageSectionTitle from "../components/PageSectionTitle";
import { Card, Chip, FormCard, btnDanger, btnPrimary, btnSecondary } from "../components/ui";

const input = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800";

/** Un cours est normalement donné à un seul groupe: en lier deux d'un coup est l'exception (groupe jumelé). */
const confirmTwinned = (n) =>
  window.confirm(
    `Tu associes ce cours à ${n} groupes à la fois. En général un cours est donné à un seul groupe : pour deux groupes différents, ajoute le cours une fois pour chacun. À faire seulement pour un groupe jumelé. Continuer ?`
  );

/**
 * Ma session: les groupes de la session, ses cours (chaque cours peut y figurer plusieurs fois, pour d'autres
 * groupes), les évaluations cochées de chaque ligne et ses groupes. C'est la seule source de ce qu'on peut
 * corriger (onglet Corriger), suivre et envoyer.
 */
export default function SessionCourses() {
  const { active } = useSession();
  const sessionId = active?._id;
  const readOnly = Boolean(active?.archivedAt);
  const [entries, setEntries] = useState([]);
  const [library, setLibrary] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [allGroups, setAllGroups] = useState([]); // groupes communs, avec leur groupe de la session s'il y en a un
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(null); // cours choisi dans la bibliothèque
  const [checked, setChecked] = useState(new Set());
  const [pickedGroups, setPickedGroups] = useState([]);
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
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(String(err.message || err));
      return false;
    }
  }

  const groups = allGroups.filter((x) => x.activeGroup);
  const rubricsOf = (courseId) => rubrics.filter((r) => String(r.course) === String(courseId) && !r.archivedAt);
  const timesGiven = (courseId) => entries.filter((e) => String(e.course._id) === String(courseId)).length;
  // Un groupe qui suit déjà ce cours dans une autre ligne ne peut pas le suivre une seconde fois.
  const takenBy = (courseId, groupId, exceptEntryId) =>
    entries.some((e) => String(e.course._id) === String(courseId) && String(e._id) !== String(exceptEntryId) && e.groups.some((g) => String(g._id) === String(groupId)));

  // Ajouter un groupe à la session, ou le retirer (archivé: ses élèves et ses corrections restent, on peut le remettre).
  function toggleSessionGroup(g) {
    if (!g.activeGroup) return act(() => api.createGroup({ name: g.name }));
    if (window.confirm(`Retirer « ${g.name} » de la session ? Ses élèves et ses corrections sont conservés ; tu pourras le remettre.`)) {
      act(() => api.archiveGroupById(g.activeGroup._id));
    }
  }

  function choose(course) {
    setPick(course);
    setChecked(new Set(rubricsOf(course._id).filter((r) => r.isActive).map((r) => String(r._id))));
    setPickedGroups(groups.length === 1 && !takenBy(course._id, groups[0].activeGroup._id) ? [groups[0].activeGroup._id] : []);
  }

  function closeAdd() {
    setAdding(false);
    setPick(null);
    setPickedGroups([]);
    setDraft({ title: "", code: "" });
  }

  const togglePicked = (id) => setPickedGroups((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function submit(createFirst) {
    if (createFirst && !draft.title.trim()) return setError("Le nom du cours est requis.");
    if (pickedGroups.length > 1 && !confirmTwinned(pickedGroups.length)) return;
    // Le cours créé ici va aussi dans Ressources > Cours (c'est le même cours).
    const ok = await act(async () => {
      const course = createFirst ? await api.createCourse({ title: draft.title.trim(), code: draft.code.trim() }) : pick;
      await api.addSessionCourse(sessionId, course._id, createFirst ? [] : [...checked], pickedGroups);
    });
    if (ok) closeAdd();
  }

  function toggleRubric(entry, rubric) {
    const rubricId = String(rubric._id);
    const ids = new Set(entry.rubrics.filter((r) => r.imported).map((r) => String(r._id)));
    if (ids.has(rubricId)) {
      if (rubric.correctedCount > 0 && !window.confirm(`« ${rubric.title} » a déjà ${rubric.correctedCount} copie(s) corrigée(s) pour ce cours. La décocher la retire de Corriger ; les copies sont conservées et reviennent si tu la recoches. Continuer ?`)) return;
      ids.delete(rubricId);
    } else ids.add(rubricId);
    act(() => api.updateSessionCourse(sessionId, entry._id, { rubricIds: [...ids] }));
  }

  function toggleEntryGroup(entry, groupId) {
    const cur = entry.groups.map((g) => String(g._id));
    const adding = !cur.includes(String(groupId));
    const next = adding ? [...cur, String(groupId)] : cur.filter((x) => x !== String(groupId));
    if (adding && next.length > 1 && !confirmTwinned(next.length)) return;
    act(() => api.updateSessionCourse(sessionId, entry._id, { groupIds: next }));
  }

  if (!active) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="ui-info text-sm">Crée ou choisis d'abord une session dans <Link to="/ressources/sessions" className="font-semibold text-blue-600 underline">Sessions</Link>.</p>
      </main>
    );
  }

  const groupChips = (selected, onToggle, isTaken) =>
    groups.length ? (
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const id = g.activeGroup._id;
          const taken = isTaken(id);
          return (
            <span key={g._id} title={taken ? "Ce groupe suit déjà ce cours dans une autre ligne" : undefined} className={taken ? "opacity-40" : ""}>
              <Chip icon={selected.includes(String(id)) ? "fa-check" : "fa-plus"} active={selected.includes(String(id))} onClick={() => !readOnly && !taken && onToggle(id)}>
                {g.name}
              </Chip>
            </span>
          );
        })}
      </div>
    ) : (
      <p className="text-xs text-gray-400">Aucun groupe dans la session. Ajoute-en dans « Groupes de la session ».</p>
    );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-book-open"
        iconBgClass="bg-emerald-600"
        title="Ma session"
        subtitle={`Session : ${active.name}. 1) Choisis tes groupes. 2) Ajoute chaque cours avec le groupe à qui tu le donnes et coche ses évaluations. Un même cours donné à deux groupes s'ajoute deux fois.`}
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
        <p className="mt-2 text-xs text-gray-500">Un groupe ajouté amène ses élèves ; un groupe retiré garde ses élèves et ses corrections. Les groupes et leurs élèves se gèrent dans Ressources.</p>
      </Card>

      {adding ? (
        <FormCard mode="Ajout" title={pick ? `Évaluations et groupe de « ${pick.title} »` : "Ajouter un cours à la session"} accent="#059669" onBack={pick ? () => setPick(null) : closeAdd} backLabel={pick ? "Autre cours" : "Annuler"}>
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
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Groupe à qui tu donnes ce cours</p>
                {groupChips(pickedGroups.map(String), togglePicked, (id) => takenBy(pick._id, id))}
                {pickedGroups.length === 0 && <p className="mt-1 text-xs text-amber-700">Sans groupe, le cours n'apparaîtra pas dans Corriger. Tu pourras en choisir un plus tard.</p>}
              </div>
              <button type="button" className={btnPrimary} onClick={() => submit(false)}>
                Ajouter le cours ({checked.size} évaluation{checked.size > 1 ? "s" : ""}, {pickedGroups.length} groupe{pickedGroups.length > 1 ? "s" : ""})
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Depuis mes cours</p>
                {library.filter((c) => !c.archivedAt).length ? (
                  <div className="flex flex-wrap gap-2">
                    {library.filter((c) => !c.archivedAt).map((c) => (
                      <Chip key={c._id} icon="fa-plus" onClick={() => choose(c)}>
                        {c.title}
                        {c.code && <span className="ml-1 opacity-60">{c.code}</span>}
                        {timesGiven(c._id) > 0 && <span className="ml-1 opacity-60">(déjà {timesGiven(c._id)} fois)</span>}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun cours dans tes ressources : crée-en un ci-dessous.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Ou un nouveau cours</p>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                  <input className={input} placeholder="Nom du cours" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <input className={input} placeholder="Code (facultatif)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                </div>
                <p className="mb-2 mt-3 text-xs font-bold uppercase text-gray-500">Groupe à qui tu donnes ce cours</p>
                {groupChips(pickedGroups.map(String), togglePicked, () => false)}
                <button type="button" className={`${btnPrimary} mt-3`} onClick={() => submit(true)}>Créer et ajouter</button>
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
            key={entry._id}
            title={
              <>
                <i className="fa-solid fa-book text-emerald-600" aria-hidden /> {entry.course.title}
                {entry.course.code && <span className="font-normal normal-case text-gray-400"> · {entry.course.code}</span>}
                {entry.groups.length === 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-800">aucun groupe</span>
                ) : (
                  entry.groups.map((g) => (
                    <span key={g._id} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-blue-700">{g.name}</span>
                  ))
                )}
              </>
            }
            actions={
              <button
                type="button"
                className={`${btnDanger} !px-2 !py-1 text-xs`}
                disabled={readOnly}
                onClick={() => {
                  if (window.confirm(`Retirer « ${entry.course.title} »${entry.groups.length ? ` (${entry.groups.map((g) => g.name).join(", ")})` : ""} de la session ? Ces groupes ne pourront plus corriger ses évaluations (les corrections déjà faites sont conservées).`))
                    act(() => api.removeSessionCourse(sessionId, entry._id));
                }}
              >
                Retirer
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Groupe{entry.groups.length > 1 ? "s" : ""} qui suivent ce cours</p>
                {groupChips(
                  entry.groups.map((g) => String(g._id)),
                  (id) => toggleEntryGroup(entry, id),
                  (id) => takenBy(entry.course._id, id, entry._id)
                )}
                {entry.groups.length > 1 && (
                  <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden />
                    Ce cours est lié à {entry.groups.length} groupes (groupe jumelé). Si ce sont deux classes distinctes, ajoute plutôt le cours une fois par groupe.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Évaluations à corriger</p>
                {entry.rubrics.length ? (
                  <div className="space-y-1.5">
                    {entry.rubrics.map((r) => (
                      <label key={r._id} className="flex flex-wrap items-center gap-2 text-sm">
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
            </div>
          </Card>
        ))}
      </div>
      <Link to="/session?tab=corriger" className={`${btnSecondary} inline-block`}>Aller corriger</Link>
    </main>
  );
}
