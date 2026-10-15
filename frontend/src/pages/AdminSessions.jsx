import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/sessionState";
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

export default function AdminSessions({ view = "sessions" }) {
  const { active, switchTo, reload: reloadActive } = useSession();
  const [sessions, setSessions] = useState([]);
  const [archived, setArchived] = useState({ courses: [], rubrics: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(null);
  const [copying, setCopying] = useState(null);
  const tab = view;

  const refresh = useCallback(async () => {
    try {
      const [sess, ac, ar, ag] = await Promise.all([
        api.listSessions(),
        api.listCoursesArchived(),
        api.listRubricsArchived(),
        api.listGroups({ archived: 1, session: "all" }),
      ]);
      setSessions(sess);
      setArchived({ courses: ac, rubrics: ar, groups: ag });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const activeSessions = sessions.filter((s) => !s.archivedAt);
  const archivedSessions = sessions.filter((s) => s.archivedAt);
  const soon = useMemo(() => sessionsArchivingSoon(sessions), [sessions]);
  // Un groupe archivé en même temps que sa session (même date) se restaure avec elle; sinon il a sa propre ligne.
  const withSession = (sessionId, archivedAt) => {
    const sess = archivedSessions.find((x) => x._id === sessionId);
    return !!sess && !!archivedAt && new Date(sess.archivedAt).getTime() === new Date(archivedAt).getTime();
  };
  const archivedCourseById = new Map(archived.courses.map((c) => [c._id, c]));
  const rubricWithCourse = (r) => {
    const c = archivedCourseById.get(r.course);
    return !!c && !!r.archivedAt && new Date(c.archivedAt).getTime() === new Date(r.archivedAt).getTime();
  };
  const sessionName = (id) => sessions.find((s) => s._id === id)?.name || "";

  async function run(fn, okMsg) {
    setError("");
    setSuccess("");
    try {
      const out = await fn();
      await Promise.all([refresh(), reloadActive()]);
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
    if (!window.confirm(`Archiver « ${s.name} » avec ses groupes et ses évaluations ? Tes cours, grilles et fiches d'élèves ne bougent pas. Tu pourras la restaurer.`)) return;
    await run(
      () => api.archiveSession(s._id),
      (o) => `Session archivée : ${o.archived.groups} groupe(s) et ${o.archived.students} inscription(s) rangés.`
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
    setError("");
    setSuccess("");
    try {
      if (!window.confirm(`Supprimer la session « ${s.name} » ? Ses groupes et inscriptions seront supprimés. Tes cours, grilles et fiches d'élèves sont conservés.`)) return;
      try {
        await api.deleteSession(s._id);
      } catch (e) {
        const n = e.data?.evaluations ?? e.payload?.evaluations;
        if (n === undefined && !/évaluation/i.test(String(e.message))) throw e;
        if (!window.confirm(`Cette session contient ${n ?? "des"} évaluation(s) qui seront supprimées avec elle. Archiver est plus sûr. Supprimer quand même ?`)) return;
        await api.deleteSession(s._id, { force: true });
      }
      await Promise.all([refresh(), reloadActive()]);
      setSuccess("Session supprimée.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function startCopy(s) {
    setCopying({
      source: s,
      name: suggestNextSessionName(s.name),
      startDate: shiftDateOneYear(s.startDate),
      endDate: shiftDateOneYear(s.endDate),
      groupIds: null,
      groups: [],
      carryStudents: false,
      carryRubrics: false,
      archiveSource: false,
    });
    api.listGroups({ session: s._id, archived: s.archivedAt ? 1 : undefined })
      .then((list) => setCopying((c) => (c && c.source._id === s._id ? { ...c, groups: list, groupIds: list.map((g) => g._id) } : c)))
      .catch((e) => setError(String(e.message || e)));
  }

  async function submitCopy() {
    const c = copying;
    const out = await run(
      () =>
        api.copySession(c.source._id, {
          name: c.name,
          startDate: c.startDate,
          endDate: c.endDate,
          groupIds: c.groupIds || undefined,
          carryStudents: c.carryStudents,
          carryRubrics: c.carryRubrics,
          archiveSource: c.archiveSource,
        }),
      (o) => `Nouvelle session créée : ${o.copied.groups} groupe(s)${o.copied.students ? `, ${o.copied.students} élève(s) reporté(s)` : ""}.`
    );
    if (out) setCopying(null);
  }

  const toggleGroup = (id) =>
    setCopying((c) => ({ ...c, groupIds: c.groupIds.includes(id) ? c.groupIds.filter((x) => x !== id) : [...c.groupIds, id] }));

  const row = "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700";

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-500">Chargement…</main>;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-box-archive"
        iconBgClass="bg-indigo-600"
        title={tab === "archives" ? "Archives" : "Sessions"}
        subtitle={tab === "archives" ? "Tout ce que tu as rangé, restaurable en un clic." : "Une session contient tes groupes, leurs élèves et leurs évaluations. Tes cours et grilles (Ressources) restent disponibles d'une session à l'autre."}
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
                    {active?._id === s._id && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Session de travail</span>
                    )}
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
                  {active?._id !== s._id && (
                    <button type="button" onClick={() => run(() => switchTo(s._id), `Tu travailles maintenant dans « ${s.name} ».`)} className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50`}><i className="fa-solid fa-right-to-bracket mr-1" />Travailler dans cette session</button>
                  )}
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

      {tab === "archives" && (
      <section className="space-y-3">
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
        {archived.courses.map((c) => (
          <div key={c._id} className={row}>
            <span className="text-sm">Cours : <b>{c.title}</b>{archived.rubrics.filter((r) => r.course === c._id).length ? ` · ${archived.rubrics.filter((r) => r.course === c._id).length} grille(s) avec lui` : ""}</span>
            <button type="button" onClick={() => run(() => api.restoreCourse(c._id), "Cours restauré avec ses grilles.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
          </div>
        ))}
        {archived.rubrics.filter((r) => !rubricWithCourse(r)).map((r) => (
          <div key={r._id} className={row}>
            <span className="text-sm">Grille : <b>{r.title}</b></span>
            <button type="button" onClick={() => run(() => api.restoreRubric(r._id), "Grille restaurée.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
          </div>
        ))}
        {archived.groups.filter((g) => !withSession(g.session, g.archivedAt)).map((g) => (
          <div key={g._id} className={row}>
            <span className="text-sm">Groupe : <b>{g.name}</b>{sessionName(g.session) ? ` · ${sessionName(g.session)}` : ""} · {g.studentCount} élève{g.studentCount > 1 ? "s" : ""}</span>
            <button type="button" onClick={() => run(() => api.restoreGroupById(g._id), "Groupe restauré.")} className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Restaurer</button>
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

      {copying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">Nouvelle session à partir de « {copying.source.name} »</h3>
            <p className="text-xs text-gray-500">Les groupes choisis sont recréés avec les mêmes cours. Les grilles ne suivent pas par défaut : tu réimportes les versions à jour dans chaque groupe. Les évaluations ne sont jamais copiées.</p>
            <input className={inputCls} value={copying.name} onChange={(e) => setCopying({ ...copying, name: e.target.value })} placeholder="Nom de la nouvelle session" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={copying.startDate} onChange={(e) => setCopying({ ...copying, startDate: e.target.value })} />
              <input type="date" className={inputCls} value={copying.endDate} onChange={(e) => setCopying({ ...copying, endDate: e.target.value })} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Groupes à reprendre</p>
              {copying.groupIds === null && <p className="text-sm text-gray-400">Chargement…</p>}
              {copying.groups.map((g) => (
                <label key={g._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.groupIds.includes(g._id)} onChange={() => toggleGroup(g._id)} />{g.name}<span className="text-gray-500"> · {g.studentCount} élève{g.studentCount > 1 ? "s" : ""}</span></label>
              ))}
              {copying.groupIds !== null && copying.groups.length === 0 && <p className="text-sm text-gray-400">Cette session n'a pas de groupe.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.carryStudents} onChange={(e) => setCopying({ ...copying, carryStudents: e.target.checked })} /> Réinscrire les mêmes élèves (leurs fiches sont réutilisées)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copying.carryRubrics} onChange={(e) => setCopying({ ...copying, carryRubrics: e.target.checked })} /> Reprendre aussi les grilles importées (risque de vieilles versions)</label>
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
