import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import PageSectionTitle from "../components/PageSectionTitle";
import {
  formatSessionDate,
  sessionCountsLabel,
  sessionsArchivingSoon,
  sessionStatusInfo,
  shiftDateOneYear,
  suggestNextSessionName,
} from "../lib/sessionHelpers";

const EMPTY_FORM = { _id: null, name: "", startDate: "", endDate: "", graceDays: 7, autoArchive: true };
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-800";
const btn = "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition";

function groupsFromStudents(students) {
  const map = new Map();
  students.forEach((s) => {
    const g = (s.group || "").trim();
    if (!g) return;
    if (!map.has(g)) map.set(g, { group: g, students: 0, session: s.session || null });
    map.get(g).students += 1;
  });
  return Array.from(map.values()).sort((a, b) => a.group.localeCompare(b.group));
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [students, setStudents] = useState([]);
  const [archived, setArchived] = useState({ courses: [], rubrics: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(null);
  const [copying, setCopying] = useState(null);
  const [tab, setTab] = useState("sessions");
  const [copyingRubric, setCopyingRubric] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [sess, c, r, st, ac, ar, ag] = await Promise.all([
        api.listSessions(),
        api.listCourses(),
        api.listRubrics(),
        api.listStudents(),
        api.listCoursesArchived(),
        api.listRubricsArchived(),
        api.listArchivedGroups(),
      ]);
      setSessions(sess);
      setCourses(c);
      setRubrics(r);
      setStudents(st);
      setArchived({ courses: ac, rubrics: ar, groups: ag });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const groups = useMemo(() => groupsFromStudents(students), [students]);
  const activeSessions = sessions.filter((s) => !s.archivedAt);
  const archivedSessions = sessions.filter((s) => s.archivedAt);
  const soon = useMemo(() => sessionsArchivingSoon(sessions), [sessions]);
  const sessionName = (id) => sessions.find((s) => s._id === id)?.name || "";

  async function run(fn, okMsg) {
    setError("");
    setSuccess("");
    try {
      const out = await fn();
      await refresh();
      if (okMsg) setSuccess(typeof okMsg === "function" ? okMsg(out) : okMsg);
      return out;
    } catch (e) {
      setError(String(e.message || e));
      return null;
    }
  }

  async function saveForm() {
    const payload = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      graceDays: Number(form.graceDays) || 0,
      autoArchive: form.autoArchive,
    };
    const out = await run(
      () => (form._id ? api.updateSession(form._id, payload) : api.createSession(payload)),
      "Session enregistrée."
    );
    if (out) setForm(null);
  }

  async function archive(s) {
    if (!window.confirm(`Archiver « ${s.name} » avec ses cours, grilles et groupes ? Tu pourras la restaurer.`)) return;
    await run(
      () => api.archiveSession(s._id),
      (o) => `Session archivée : ${o.archived.courses} cours, ${o.archived.rubrics} grilles, ${o.archived.students} étudiants rangés.`
    );
  }

  async function exportCsv(s) {
    try {
      const { blob, filename } = await api.exportSessionCsv(s._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function removeSession(s) {
    if (!window.confirm(`Supprimer la session « ${s.name} » ? Cours, grilles et groupes sont conservés (détachés).`)) return;
    await run(() => api.deleteSession(s._id), "Session supprimée.");
  }

  function startCopy(s) {
    setCopying({
      source: s,
      name: suggestNextSessionName(s.name),
      startDate: shiftDateOneYear(s.startDate),
      endDate: shiftDateOneYear(s.endDate),
      groupsText: "",
      courseIds: courses.filter((c) => c.session === s._id).map((c) => c._id),
      rubricIds: rubrics.filter((r) => r.session === s._id).map((r) => r._id),
      archiveSource: false,
    });
  }

  async function submitCopy() {
    const c = copying;
    const out = await run(
      () =>
        api.copySession(c.source._id, {
          name: c.name,
          startDate: c.startDate,
          endDate: c.endDate,
          courseIds: c.courseIds,
          rubricIds: c.rubricIds,
          groups: c.groupsText.split(/[,;\n]/).map((g) => g.trim()).filter(Boolean),
          archiveSource: c.archiveSource,
        }),
      (o) => `Nouvelle session créée : ${o.copied.courses} cours et ${o.copied.rubrics} grilles copiés.`
    );
    if (out) setCopying(null);
  }

  const toggleIn = (key, id) =>
    setCopying((c) => ({ ...c, [key]: c[key].includes(id) ? c[key].filter((x) => x !== id) : [...c[key], id] }));

  function SessionSelect({ value, onChange }) {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value || null)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800">
        <option value="">Sans session</option>
        {activeSessions.map((s) => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>
    );
  }

  const row = "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700";

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-500">Chargement…</main>;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-box-archive"
        iconBgClass="bg-indigo-600"
        title="Sessions et archives"
        subtitle="Regroupe tes cours, grilles et groupes par session. À la fin, tout s'archive tout seul et tu repars à neuf."
      />

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>}

      {soon.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {soon.map(({ session, days }) => (
            <p key={session._id}>
              <i className="fa-solid fa-hourglass-half mr-1" />
              « {session.name} » {days <= 0 ? "sera archivée très bientôt" : `s'archive dans ${days} jour${days > 1 ? "s" : ""}`}. Envoie tes courriels et exporte les notes avant.
            </p>
          ))}
        </div>
      )}

      <nav className="flex gap-2" aria-label="Sections">
        {[["sessions", "Sessions"], ["elements", "Cours, grilles et groupes"], ["archives", `Archives (${archivedSessions.length + archived.courses.length + archived.rubrics.length + archived.groups.length})`]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tab === id ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"}`}>{label}</button>
        ))}
      </nav>

      {tab === "sessions" && (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Sessions</h2>
          <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <i className="fa-solid fa-plus mr-1" /> Nouvelle session
          </button>
        </div>
        {activeSessions.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Aucune session active. Crée-en une avec ses dates : elle s'archivera automatiquement après sa fin.</p>
        )}
        {activeSessions.map((s) => {
          const st = sessionStatusInfo(s.status);
          return (
            <div key={s._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Du {formatSessionDate(s.startDate)} au {formatSessionDate(s.endDate)}
                    {s.autoArchive !== false
                      ? ` · archivage auto le ${formatSessionDate(s.archiveAfter)}`
                      : " · archivage auto désactivé"}
                  </p>
                  <p className="text-xs text-gray-500">{sessionCountsLabel(s.counts)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => startCopy(s)} className={`${btn} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}><i className="fa-solid fa-copy mr-1" />Nouvelle session à partir de celle-ci</button>
                  <button type="button" onClick={() => exportCsv(s)} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}><i className="fa-solid fa-file-csv mr-1" />Notes (CSV)</button>
                  <button type="button" onClick={() => setForm({ ...s })} className={`${btn} border-gray-200 text-gray-700 hover:bg-gray-50`}>Modifier</button>
                  <button type="button" onClick={() => archive(s)} className={`${btn} border-amber-300 text-amber-800 hover:bg-amber-50`}><i className="fa-solid fa-box-archive mr-1" />Archiver</button>
                  <button type="button" onClick={() => removeSession(s)} className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}>Supprimer</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
      )}

      {tab === "elements" && (
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Éléments actifs</h2>
        <p className="text-sm text-gray-500">Rattache chaque cours, grille et groupe à une session. Archiver un élément seul le range sans toucher au reste.</p>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase text-gray-500">Cours ({courses.length})</h3>
          {courses.map((c) => (
            <div key={c._id} className={row}>
              <span className="text-sm font-semibold">{c.title}{c.code ? ` (${c.code})` : ""}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <SessionSelect value={c.session} onChange={(sid) => run(() => api.updateCourse(c._id, { session: sid }))} />
                <button type="button" onClick={() => run(() => api.copyCourse(c._id, c.session), "Cours copié.")} className={`${btn} border-gray-200 hover:bg-gray-50`}>Copier</button>
                <button type="button" onClick={() => run(() => api.archiveCourse(c._id), "Cours archivé.")} className={`${btn} border-amber-300 text-amber-800 hover:bg-amber-50`}>Archiver</button>
              </div>
            </div>
          ))}
          {courses.length === 0 && <p className="text-sm text-gray-400">Aucun cours actif.</p>}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase text-gray-500">Grilles ({rubrics.length})</h3>
          {rubrics.map((r) => (
            <div key={r._id} className={row}>
              <span className="text-sm font-semibold">{r.title}<span className="font-normal text-gray-500"> · {(r.groups?.length ? r.groups : r.group ? [r.group] : []).join(", ") || "tous les groupes"}</span></span>
              <div className="flex flex-wrap items-center gap-1.5">
                <SessionSelect value={r.session} onChange={(sid) => run(() => api.updateRubric(r._id, { session: sid }))} />
                <button type="button" onClick={() => setCopyingRubric({ rubric: r, selected: [], extra: "", title: r.title })} className={`${btn} border-gray-200 hover:bg-gray-50`}>
                  Copier vers…
                </button>
                <button type="button" onClick={() => run(() => api.archiveRubric(r._id), "Grille archivée.")} className={`${btn} border-amber-300 text-amber-800 hover:bg-amber-50`}>Archiver</button>
              </div>
            </div>
          ))}
          {rubrics.length === 0 && <p className="text-sm text-gray-400">Aucune grille active.</p>}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase text-gray-500">Groupes ({groups.length})</h3>
          {groups.map((g) => (
            <div key={g.group} className={row}>
              <span className="text-sm font-semibold">{g.group}<span className="font-normal text-gray-500"> · {g.students} étudiant{g.students > 1 ? "s" : ""}</span></span>
              <div className="flex flex-wrap items-center gap-1.5">
                <SessionSelect value={g.session} onChange={(sid) => run(() => api.setGroupSession(g.group, sid))} />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Archiver le groupe « ${g.group} » ? Ses étudiants et évaluations sont conservés.`)) run(() => api.archiveGroup(g.group), "Groupe archivé.");
                  }}
                  className={`${btn} border-amber-300 text-amber-800 hover:bg-amber-50`}
                >
                  Archiver
                </button>
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-400">Aucun groupe actif.</p>}
        </div>
      </section>
      )}

      {tab === "archives" && (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Archives</h2>
        {archivedSessions.map((s) => (
          <div key={s._id} className={row}>
            <div>
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-xs text-gray-500"> · {formatSessionDate(s.startDate)} au {formatSessionDate(s.endDate)} · {s.archivedBy === "auto" ? "archivée automatiquement" : "archivée manuellement"} · {sessionCountsLabel(s.counts)}</span>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => startCopy(s)} className={`${btn} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}>Nouvelle session à partir de celle-ci</button>
              <button type="button" onClick={() => exportCsv(s)} className={`${btn} border-gray-200 hover:bg-gray-50`}>Notes (CSV)</button>
              <button type="button" onClick={() => run(() => api.restoreSession(s._id), "Session restaurée.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
            </div>
          </div>
        ))}
        {archived.courses.filter((c) => !archivedSessions.some((s) => s._id === c.session)).map((c) => (
          <div key={c._id} className={row}>
            <span className="text-sm">Cours : <b>{c.title}</b>{c.session ? ` · ${sessionName(c.session)}` : ""}</span>
            <button type="button" onClick={() => run(() => api.restoreCourse(c._id), "Cours restauré.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
          </div>
        ))}
        {archived.rubrics.filter((r) => !archivedSessions.some((s) => s._id === r.session)).map((r) => (
          <div key={r._id} className={row}>
            <span className="text-sm">Grille : <b>{r.title}</b></span>
            <button type="button" onClick={() => run(() => api.restoreRubric(r._id), "Grille restaurée.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
          </div>
        ))}
        {archived.groups.filter((g) => !archivedSessions.some((s) => s._id === g.session)).map((g) => (
          <div key={g.group} className={row}>
            <span className="text-sm">Groupe : <b>{g.group}</b> · {g.students} étudiant{g.students > 1 ? "s" : ""}</span>
            <button type="button" onClick={() => run(() => api.restoreGroup(g.group), "Groupe restauré.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
          </div>
        ))}
        {archivedSessions.length + archived.courses.length + archived.rubrics.length + archived.groups.length === 0 && (
          <p className="text-sm text-gray-400">Rien d'archivé pour l'instant.</p>
        )}
      </section>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">{form._id ? "Modifier la session" : "Nouvelle session"}</h3>
            <input className={inputCls} placeholder="Nom (ex. Automne 2026)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-gray-500">Début<input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label className="text-xs font-semibold text-gray-500">Fin<input type="date" className={inputCls} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoArchive !== false} onChange={(e) => setForm({ ...form, autoArchive: e.target.checked })} /> Archiver automatiquement après la fin</label>
            <label className="flex items-center gap-2 text-sm">Délai de grâce (jours)
              <input type="number" min="0" max="365" className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800" value={form.graceDays} onChange={(e) => setForm({ ...form, graceDays: e.target.value })} />
            </label>
            <p className="text-xs text-gray-500">Le délai de grâce te laisse le temps de finir les corrections et d'envoyer les courriels avant l'archivage.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={`${btn} border-gray-200`}>Annuler</button>
              <button type="button" onClick={saveForm} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {copyingRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">Copier la grille vers de nouveaux groupes</h3>
            <p className="text-xs text-gray-500">La copie repart en version 1, sans évaluations. L'original reste inchangé.</p>
            <input className={inputCls} value={copyingRubric.title} onChange={(e) => setCopyingRubric({ ...copyingRubric, title: e.target.value })} />
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {groups.map((g) => (
                <label key={g.group} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={copyingRubric.selected.includes(g.group)} onChange={() => setCopyingRubric((c) => ({ ...c, selected: c.selected.includes(g.group) ? c.selected.filter((x) => x !== g.group) : [...c.selected, g.group] }))} />
                  {g.group}
                </label>
              ))}
              {groups.length === 0 && <p className="text-sm text-gray-400">Aucun groupe actif : saisis les noms ci-dessous.</p>}
            </div>
            <input className={inputCls} placeholder="Autres groupes (séparés par des virgules)" value={copyingRubric.extra} onChange={(e) => setCopyingRubric({ ...copyingRubric, extra: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCopyingRubric(null)} className={`${btn} border-gray-200`}>Annuler</button>
              <button
                type="button"
                onClick={async () => {
                  const c = copyingRubric;
                  const extra = c.extra.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
                  const out = await run(
                    () => api.copyRubric(c.rubric._id, { title: c.title, groups: [...c.selected, ...extra], sessionId: c.rubric.session || null }),
                    "Grille copiée (version 1, sans évaluations)."
                  );
                  if (out) setCopyingRubric(null);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Copier
              </button>
            </div>
          </div>
        </div>
      )}

      {copying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">Nouvelle session à partir de « {copying.source.name} »</h3>
            <p className="text-xs text-gray-500">Les cours (avec leurs compétences) et les grilles choisis sont copiés. Les étudiants et les évaluations ne sont pas copiés : les grilles repartent en version 1.</p>
            <input className={inputCls} value={copying.name} onChange={(e) => setCopying({ ...copying, name: e.target.value })} placeholder="Nom de la nouvelle session" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={copying.startDate} onChange={(e) => setCopying({ ...copying, startDate: e.target.value })} />
              <input type="date" className={inputCls} value={copying.endDate} onChange={(e) => setCopying({ ...copying, endDate: e.target.value })} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Cours à copier</p>
              {courses.filter((c) => c.session === copying.source._id).concat(archived.courses.filter((c) => c.session === copying.source._id)).map((c) => (
                <label key={c._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.courseIds.includes(c._id)} onChange={() => toggleIn("courseIds", c._id)} />{c.title}</label>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Grilles à copier</p>
              {rubrics.filter((r) => r.session === copying.source._id).concat(archived.rubrics.filter((r) => r.session === copying.source._id)).map((r) => (
                <label key={r._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.rubricIds.includes(r._id)} onChange={() => toggleIn("rubricIds", r._id)} />{r.title}</label>
              ))}
            </div>
            <label className="block text-xs font-bold uppercase text-gray-500">Groupes de la nouvelle session (pour les grilles)
              <input className={`${inputCls} mt-1 font-normal normal-case`} placeholder="ex. 420-AB1, 420-AB2" value={copying.groupsText} onChange={(e) => setCopying({ ...copying, groupsText: e.target.value })} />
            </label>
            {!copying.source.archivedAt && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.archiveSource} onChange={(e) => setCopying({ ...copying, archiveSource: e.target.checked })} /> Archiver « {copying.source.name} » ensuite</label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCopying(null)} className={`${btn} border-gray-200`}>Annuler</button>
              <button type="button" onClick={submitCopy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Créer la session</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
