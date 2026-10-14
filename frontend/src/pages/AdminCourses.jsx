import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { parseCompetencyLines } from "../lib/courseHelpers";
import PageSectionTitle from "../components/PageSectionTitle";

const EMPTY_COURSE = { _id: null, title: "", code: "", competencies: [] };

function newCompetency(title = "", description = "") {
  return { id: `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title, description };
}

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(EMPTY_COURSE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessions, setSessions] = useState([]);

  async function refresh(selectId) {
    try {
      const list = await api.listCourses();
      setCourses(list);
      if (selectId) {
        const found = list.find((c) => c._id === selectId);
        if (found) setCourse({ ...found, competencies: found.competencies || [] });
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    api.listSessions().then((list) => setSessions(list.filter((x) => !x.archivedAt))).catch(() => {});
  }, []);

  function selectCourse(c) {
    setCourse({ ...c, competencies: c.competencies || [] });
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    setShowBulk(false);
  }

  function newCourse() {
    setCourse({ ...EMPTY_COURSE, competencies: [newCompetency()] });
    setError("");
    setSuccess("");
    setConfirmDelete(false);
  }

  function updateCompetency(index, field, value) {
    setCourse((c) => ({
      ...c,
      competencies: c.competencies.map((comp, i) => (i === index ? { ...comp, [field]: value } : comp)),
    }));
  }

  function removeCompetency(index) {
    setCourse((c) => ({ ...c, competencies: c.competencies.filter((_, i) => i !== index) }));
  }

  function moveCompetency(index, delta) {
    setCourse((c) => {
      const next = [...c.competencies];
      const target = index + delta;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...c, competencies: next };
    });
  }

  function addFromBulk() {
    const parsed = parseCompetencyLines(bulkText);
    if (!parsed.length) {
      setError("Collez au moins une ligne (une compétence ou un critère par ligne).");
      return;
    }
    setCourse((c) => ({
      ...c,
      competencies: [...c.competencies.filter((x) => x.title.trim()), ...parsed.map((p) => newCompetency(p.title, p.description))],
    }));
    setBulkText("");
    setShowBulk(false);
    setError("");
  }

  async function save() {
    setError("");
    setSuccess("");
    if (!course.title.trim()) {
      setError("Le nom du cours est requis.");
      return;
    }
    const payload = {
      title: course.title.trim(),
      code: (course.code || "").trim(),
      session: course.session || null,
      competencies: course.competencies
        .filter((c) => c.title.trim())
        .map((c) => ({ id: String(c.id).startsWith("new-") ? undefined : c.id, title: c.title.trim(), description: (c.description || "").trim() })),
    };
    setSaving(true);
    try {
      const saved = course._id ? await api.updateCourse(course._id, payload) : await api.createCourse(payload);
      await refresh(saved._id);
      setSuccess("Cours enregistré.");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function archiveCurrent() {
    if (!course._id) return;
    try {
      await api.archiveCourse(course._id);
      setCourse(EMPTY_COURSE);
      await refresh();
      setSuccess("Cours archivé (avec ses grilles « archivées avec le cours »). Tu peux le restaurer dans Classes > Archives.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function remove() {
    if (!course._id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.deleteCourse(course._id);
      setCourse(EMPTY_COURSE);
      setConfirmDelete(false);
      await refresh();
      setSuccess("Cours supprimé. Les grilles déjà créées ne sont pas modifiées.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageSectionTitle
        icon="fa-book-open"
        iconBgClass="bg-emerald-600"
        title="Cours et compétences"
        subtitle="Entrez une fois les compétences (ou critères de performance) de chaque cours : elles seront ajoutées automatiquement au gabarit IA."
      />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <aside className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-1 dark:border-gray-700/60 dark:bg-gray-900/40">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Mes cours</h2>
            <button type="button" onClick={newCourse} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              <i className="fa-solid fa-plus mr-1" /> Nouveau cours
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun cours pour le moment. Créez-en un pour y entrer ses compétences.</p>
          ) : (
            <ul className="space-y-1.5">
              {courses.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => selectCourse(c)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      course._id === c._id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-200"
                    }`}
                  >
                    <span className="block font-semibold">{c.code ? `${c.code} · ` : ""}{c.title}</span>
                    <span className="text-xs text-gray-500">{(c.competencies || []).length} compétence(s)</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2 dark:border-gray-700/60 dark:bg-gray-900/40">
          {!course._id && course.competencies.length === 0 && !course.title ? (
            <p className="text-sm text-gray-500">Choisis un cours dans la liste, ou crée-en un nouveau.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Nom du cours</label>
                  <input type="text" value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} placeholder="Ex : Déploiement de services réseau" className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Code (facultatif)</label>
                  <input type="text" value={course.code || ""} onChange={(e) => setCourse({ ...course, code: e.target.value })} placeholder="Ex : 420-XYZ" className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Session</label>
                  <select value={course.session || ""} onChange={(e) => setCourse({ ...course, session: e.target.value || null })} className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Aucune session (le cours reste actif)</option>
                    {sessions.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Le cours est archivé avec sa session, ainsi que les grilles réglées sur « archivée avec le cours ».</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Compétences / critères de performance ({course.competencies.length})</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBulk(!showBulk)} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                      <i className="fa-solid fa-paste mr-1" /> Coller une liste
                    </button>
                    <button type="button" onClick={() => setCourse({ ...course, competencies: [...course.competencies, newCompetency()] })} className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <i className="fa-solid fa-plus mr-1" /> Ajouter
                    </button>
                  </div>
                </div>

                {showBulk && (
                  <div className="mb-3 space-y-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-3">
                    <p className="text-xs text-emerald-900">Copiez la liste depuis votre plan de cours : une compétence ou un critère par ligne. La numérotation (1., 2), -) est retirée automatiquement.</p>
                    <textarea rows={5} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"1. Analyser le projet de déploiement\n2. Installer et administrer les services d'infrastructure réseau\n3. Planifier l'implantation de services infonuagiques"} className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button type="button" onClick={addFromBulk} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Ajouter ces lignes</button>
                  </div>
                )}

                {course.competencies.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Aucune compétence. Ajoutez-les une par une ou collez la liste de votre plan de cours.</p>
                ) : (
                  <ol className="space-y-2">
                    {course.competencies.map((comp, i) => (
                      <li key={comp.id} className="rounded-lg border border-gray-200 bg-slate-50/60 p-2.5 dark:border-gray-600 dark:bg-gray-800/30">
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{i + 1}</span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <input type="text" value={comp.title} onChange={(e) => updateCompetency(i, "title", e.target.value)} placeholder="Compétence ou critère de performance" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-400" />
                            <textarea rows={2} value={comp.description || ""} onChange={(e) => updateCompetency(i, "description", e.target.value)} placeholder="Précisions pour l'IA (facultatif) : éléments de la compétence, contexte…" className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 outline-none focus:ring-1 focus:ring-emerald-400" />
                          </div>
                          <div className="flex shrink-0 flex-col gap-0.5">
                            <button type="button" onClick={() => moveCompetency(i, -1)} disabled={i === 0} className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Monter"><i className="fa-solid fa-chevron-up" /></button>
                            <button type="button" onClick={() => moveCompetency(i, 1)} disabled={i === course.competencies.length - 1} className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Descendre"><i className="fa-solid fa-chevron-down" /></button>
                            <button type="button" onClick={() => removeCompetency(i)} className="px-1.5 text-red-400 hover:text-red-600" title="Supprimer"><i className="fa-solid fa-xmark" /></button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
                <div>
                  {course._id && (
                    <button type="button" onClick={archiveCurrent} className="mr-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                      <i className="fa-solid fa-box-archive mr-1" /> Archiver
                    </button>
                  )}
                  {course._id && (
                    <button type="button" onClick={remove} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${confirmDelete ? "border-red-600 bg-red-600 text-white" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                      {confirmDelete ? "Confirmer la suppression" : "Supprimer le cours"}
                    </button>
                  )}
                </div>
                <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? "Enregistrement…" : "Enregistrer le cours"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
