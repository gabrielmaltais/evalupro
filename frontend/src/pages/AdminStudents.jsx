import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { studentDisplayName, splitFullName } from "../lib/studentDisplay";
import PageSectionTitle from "../components/PageSectionTitle";
import MarkerBadge, { MarkerStyleControls } from "../components/MarkerBadge";

/** Une ligne d’import : nom seul, ou nom + courriel (tab, point-virgule, ou virgule si la partie droite ressemble à un mail). */
function parseStudentBulkLine(line) {
  const t = line.trim();
  if (!t) return null;
  if (t.includes("\t")) {
    const parts = t.split("\t");
    const name = (parts[0] || "").trim();
    const email = parts.slice(1).join("\t").trim();
    if (!name) return null;
    return { name, email: email || undefined };
  }
  const semi = t.indexOf(";");
  if (semi !== -1) {
    const name = t.slice(0, semi).trim();
    const email = t.slice(semi + 1).trim();
    if (!name) return null;
    return { name, email: email || undefined };
  }
  const commaIdx = t.indexOf(",");
  if (commaIdx !== -1) {
    const after = t.slice(commaIdx + 1).trim();
    if (after.includes("@")) {
      const name = t.slice(0, commaIdx).trim();
      if (!name) return null;
      return { name, email: after || undefined };
    }
  }
  return { name: t };
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [groupDashboard, setGroupDashboard] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [studentEvals, setStudentEvals] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [renameGroupTo, setRenameGroupTo] = useState("");
  const [draftGroups, setDraftGroups] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [purgeGroupModal, setPurgeGroupModal] = useState(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purgeAckIrreversible, setPurgeAckIrreversible] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [groupStyles, setGroupStyles] = useState([]);
  const [groupMarkerDraft, setGroupMarkerDraft] = useState({ color: "", icon: "" });

  async function refresh() {
    try {
      const [data, dashboard, styles] = await Promise.all([
        api.listStudents(),
        api.getStudentGroupDashboard(),
        api.listGroupStyles(),
      ]);
      setStudents(data);
      setGroupDashboard(dashboard || []);
      setGroupStyles(styles || []);
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const groupedStudents = useMemo(() => students.reduce((acc, s) => {
    const g = s.group || "Sans groupe";
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {}), [students]);
  const groupKeys = Object.keys(groupedStudents).sort();
  const allGroupKeys = Array.from(new Set([...groupKeys, ...draftGroups])).sort();
  const groupStyleByLabel = useMemo(() => {
    const m = {};
    for (const s of groupStyles) {
      if (s?.groupKey) m[s.groupKey] = s;
    }
    return m;
  }, [groupStyles]);

  useEffect(() => {
    if (!selectedGroup) {
      setGroupMarkerDraft({ color: "", icon: "" });
      return;
    }
    const row = groupStyles.find((x) => x.groupKey === selectedGroup);
    setGroupMarkerDraft({ color: row?.color || "", icon: row?.icon || "" });
  }, [selectedGroup, groupStyles]);

  const displayedGroupDashboard = useMemo(() => {
    const map = new Map((groupDashboard || []).map((g) => [g.group, g]));
    draftGroups.forEach((g) => {
      if (!map.has(g)) {
        map.set(g, { group: g, students: 0, evaluations: 0, avgPct: 0, sent: 0, failed: 0 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.group.localeCompare(b.group));
  }, [groupDashboard, draftGroups]);
  const filteredStudents = selectedGroup ? (groupedStudents[selectedGroup] || []) : students;

  function startNew() {
    setSelectedId(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setGroup(selectedGroup || "");
    setBulkMode(false);
    setConfirmDelete(false);
    setStudentEvals([]);
  }
  function startBulk() {
    startNew();
    setBulkMode(true);
  }
  async function selectStudent(s) {
    setSelectedId(s._id);
    if (s.firstName || s.lastName) {
      setFirstName(s.firstName || "");
      setLastName(s.lastName || "");
    } else {
      const sp = splitFullName(s.name);
      setFirstName(sp.firstName);
      setLastName(sp.lastName);
    }
    setEmail(s.email || "");
    setGroup(s.group || "");
    setBulkMode(false);
    setConfirmDelete(false);
    try {
      const result = await api.listEvaluationsByStudent(s._id);
      setStudentEvals(result.items || []);
    } catch {
      setStudentEvals([]);
    }
  }
  async function save() {
    setError("");
    setSuccess("");
    try {
      if (selectedId) {
        await api.updateStudent(selectedId, { firstName, lastName, email, group });
        setSuccess("Étudiant modifié.");
      } else {
        await api.createStudent({ firstName, lastName, email, group });
        setSuccess("Étudiant ajouté.");
      }
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function saveBulk() {
    setError("");
    setSuccess("");
    try {
      const parsed = bulkText.split("\n").map(parseStudentBulkLine).filter(Boolean);
      if (!parsed.length) return setError("La liste est vide.");
      const studentsPayload = parsed.map((p) => ({
        name: p.name,
        ...(p.email ? { email: p.email } : {}),
        ...(group.trim() ? { group: group.trim() } : {}),
      }));
      await api.createStudentsBulk({ students: studentsPayload });
      setSuccess(`${parsed.length} étudiants importés.`);
      setBulkText("");
      setBulkMode(false);
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function removeStudent() {
    if (!selectedId) return;
    try {
      await api.deleteStudent(selectedId);
      setSuccess("Étudiant supprimé.");
      startNew();
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function removeEval(evalId) {
    if (!window.confirm("Supprimer cette évaluation ?")) return;
    try {
      await api.deleteEvaluation(evalId);
      setStudentEvals((prev) => prev.filter((e) => e._id !== evalId));
      await refresh();
    } catch {
      setError("Suppression impossible.");
    }
  }
  async function renameSelectedGroup() {
    if (!selectedGroup) {
      setError("Sélectionnez d'abord un groupe.");
      return;
    }
    if (!renameGroupTo.trim()) {
      setError("Indiquez le nouveau nom du groupe.");
      return;
    }
    try {
      await api.renameGroup(selectedGroup, renameGroupTo.trim());
      setSuccess("Groupe renommé.");
      setSelectedGroup(renameGroupTo.trim());
      setRenameGroupTo("");
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  function prepareNewGroup() {
    const groupName = newGroupName.trim();
    if (!groupName) {
      setError("Nom du groupe requis.");
      return;
    }
    setError("");
    setSuccess("");
    setSelectedGroup(groupName);
    setDraftGroups((prev) => (prev.includes(groupName) ? prev : [...prev, groupName]));
    setNewGroupName("");
    setSelectedId(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setGroup(groupName);
    setBulkMode(false);
    setConfirmDelete(false);
    setStudentEvals([]);
    setSuccess(`Groupe "${groupName}" prêt. Ajoutez un étudiant pour le créer.`);
  }
  async function clearGroup(groupName) {
    if (!window.confirm(`Retirer le groupe "${groupName}" ?`)) return;
    try {
      await api.clearGroup(groupName);
      setSuccess("Groupe vidé.");
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function openPurgeGroupModal(groupName) {
    if (groupName === "Sans groupe") return;
    setError("");
    setPurgeConfirmText("");
    setPurgeAckIrreversible(false);
    setPurgeGroupModal(groupName);
  }

  function closePurgeGroupModal() {
    if (purgeBusy) return;
    setPurgeGroupModal(null);
    setPurgeConfirmText("");
    setPurgeAckIrreversible(false);
  }

  async function executePurgeGroup() {
    if (!purgeGroupModal || purgeBusy) return;
    const target = purgeGroupModal.trim();
    if (purgeConfirmText.trim() !== target) {
      setError("Le nom saisi doit correspondre exactement au groupe.");
      return;
    }
    if (!purgeAckIrreversible) return;
    setPurgeBusy(true);
    setError("");
    try {
      const res = await api.deleteGroupWithStudents(target, purgeConfirmText.trim());
      const parts = [
        `${res.deletedStudents} étudiant(s)`,
        `${res.deletedEvaluations} évaluation(s)`,
        `${res.deletedDeliveries} entrée(s) d’envoi`,
      ].join(", ");
      setSuccess(`Groupe « ${target} » supprimé (${parts}).`);
      if (selectedGroup === target) {
        setSelectedGroup("");
        startNew();
      }
      closePurgeGroupModal();
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setPurgeBusy(false);
    }
  }

  function selectGroupFilter(groupName) {
    setSelectedGroup(groupName);
  }

  async function saveGroupMarker() {
    if (!selectedGroup) {
      setError("Sélectionnez d'abord un groupe.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const c = (groupMarkerDraft.color || "").trim();
      const i = (groupMarkerDraft.icon || "").trim();
      if (!c && !i) {
        await api.deleteGroupStyle(selectedGroup);
        setSuccess("Repère du groupe retiré.");
      } else {
        await api.upsertGroupStyle(selectedGroup, { color: c, icon: i });
        setSuccess("Repère du groupe enregistré.");
      }
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function clearGroupFilter() {
    setSelectedGroup("");
  }

  return (
    <div className="flex w-full flex-1 flex-col text-gray-800 dark:text-gray-100">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageSectionTitle
          icon="fa-users-between-lines"
          iconBgClass="bg-blue-600"
          title="Élèves et groupes"
          subtitle="Classes, groupes et étudiants"
        />
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">{success}</div>}

        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <h2 className="text-base font-bold mb-1">Groupes</h2>
                <p className="text-xs text-gray-500 mb-3">Cliquez un groupe pour afficher uniquement les étudiants de ce groupe.</p>
                <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
                  {displayedGroupDashboard.map((g) => {
                    const isActive = selectedGroup === g.group;
                    return (
                      <div
                        key={g.group}
                        className={`flex gap-2 rounded-xl border p-0.5 transition ${
                          isActive
                            ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200/80 dark:bg-blue-950/30 dark:ring-blue-500/40"
                            : "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectGroupFilter(g.group)}
                          className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
                            isActive ? "" : "hover:bg-gray-100/90 dark:hover:bg-gray-800/70"
                          }`}
                          aria-pressed={isActive}
                          aria-label={`Afficher les étudiants du groupe ${g.group}`}
                        >
                          <span className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
                            <MarkerBadge
                              color={groupStyleByLabel[g.group]?.color}
                              icon={groupStyleByLabel[g.group]?.icon}
                            />
                            <span className="block">{g.group}</span>
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 block">
                            {g.students} étu. • {g.evaluations} évals.
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-col gap-0.5 self-start">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearGroup(g.group);
                            }}
                            className="rounded-lg px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:underline dark:hover:bg-red-950/50"
                            title={`Retirer le nom de groupe des étudiants (sans les supprimer)`}
                          >
                            Vider
                          </button>
                          {g.group !== "Sans groupe" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPurgeGroupModal(g.group);
                              }}
                              className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white bg-red-700 hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-950"
                              title="Supprimer définitivement le groupe et tous les étudiants"
                            >
                              Tout suppr.
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {displayedGroupDashboard.length === 0 && <p className="text-sm text-gray-500">Aucun groupe.</p>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Créer un groupe</h3>
                  <input className="w-full border rounded-lg px-3 py-2 mb-2" placeholder="Nom du nouveau groupe" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  <button onClick={prepareNewGroup} className="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm">Créer</button>
                  <p className="text-xs text-gray-500 mt-2">Un groupe existe dès qu'au moins un étudiant y est ajouté.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Modifier le groupe actif</h3>
                  <div className="text-xs text-gray-500 mb-2">Groupe sélectionné: <span className="font-semibold text-gray-700">{selectedGroup || "Aucun"}</span></div>
                  <input className="w-full border rounded-lg px-3 py-2 mb-2" placeholder="Nouveau nom du groupe actif" value={renameGroupTo} onChange={(e) => setRenameGroupTo(e.target.value)} />
                  <button onClick={renameSelectedGroup} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm">Renommer</button>
                </div>
                <div className="border-t border-gray-100 pt-4 dark:border-gray-700">
                  <h3 className="mb-2 font-semibold text-sm">Repère visuel du groupe</h3>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Couleur et icône affichées dans la liste des étudiants, le hub d&apos;évaluation et les tableaux de suivi.
                  </p>
                  {selectedGroup ? (
                    <>
                      <MarkerStyleControls
                        idPrefix="admin-group-marker"
                        color={groupMarkerDraft.color}
                        icon={groupMarkerDraft.icon}
                        onChange={(patch) => setGroupMarkerDraft((d) => ({ ...d, ...patch }))}
                      />
                      <button
                        type="button"
                        onClick={() => saveGroupMarker()}
                        className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Enregistrer le repère
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">Sélectionnez un groupe dans la liste pour définir son apparence.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={startNew} className="flex-1 text-sm rounded-lg border border-gray-300 bg-white py-2 font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-700/60">
                  Ajouter
                </button>
                <button type="button" onClick={startBulk} className="flex-1 text-sm rounded-lg border border-gray-300 bg-white py-2 font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100 dark:hover:bg-gray-700/60">
                  Importer
                </button>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold">
                  Étudiants
                  {selectedGroup ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400"> · {selectedGroup}</span>
                  ) : (
                    <span className="font-normal text-gray-500 dark:text-gray-400 text-sm"> · tous les groupes</span>
                  )}
                </h2>
                {selectedGroup ? (
                  <button
                    type="button"
                    onClick={clearGroupFilter}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Tous les étudiants
                  </button>
                ) : null}
              </div>
              <div className="space-y-1 max-h-[68vh] overflow-y-auto">
                {filteredStudents.map((s) => (
                  <button key={s._id} onClick={() => selectStudent(s)} className={`w-full text-left p-2 rounded-lg ${selectedId === s._id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{studentDisplayName(s)}</div>
                      <div className="text-xs text-gray-500">{s.email || "Sans email"}</div>
                    </div>
                  </button>
                ))}
                {filteredStudents.length === 0 && <p className="text-sm text-gray-500 p-2">Aucun étudiant pour ce filtre.</p>}
              </div>
            </div>

            <div className="xl:col-span-6 bg-white rounded-2xl border border-gray-100 p-5">
              {bulkMode ? (
                <div>
                  <h2 className="text-lg font-bold mb-3">Import en lot</h2>
                  <input className="w-full border rounded-lg px-3 py-2 mb-2" placeholder="Groupe cible" value={group} onChange={(e) => setGroup(e.target.value)} />
                  <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                    Une ligne par étudiant : <strong>prénom et nom</strong> (ex. <code className="bg-gray-100 px-0.5 rounded text-[11px]">Jean Tremblay</code> — le premier mot = prénom, le reste = nom), ou la même chose suivie d’une tabulation, d’un point-virgule ou d’une virgule (si le courriel contient <code className="bg-gray-100 px-0.5 rounded">@</code>) puis le <strong>courriel</strong>.
                    Ex. <code className="bg-gray-100 px-1 rounded text-[11px]">Marie Curie	marie@ecole.ca</code> ou{" "}
                    <code className="bg-gray-100 px-1 rounded text-[11px]">Paul Martin;paul@ecole.ca</code>
                  </p>
                  <div className="mb-2">
                    <a
                      href={`${import.meta.env.BASE_URL}exemple-import-etudiants.txt`}
                      download="exemple-import-etudiants.txt"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <i className="fa-solid fa-file-arrow-down" aria-hidden />
                      Télécharger un fichier d’exemple (.txt)
                    </a>
                  </div>
                  <textarea rows={10} className="w-full border rounded-lg px-3 py-2 font-mono text-sm" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"Jean Dupont\nClaire Boisclair\tclaire@ecole.ca\nLuc;luc@ecole.ca"} />
                  <div className="mt-3 flex justify-end"><button onClick={saveBulk} className="bg-emerald-600 text-white rounded-lg px-4 py-2">Importer</button></div>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-bold mb-3">{selectedId ? "Modifier l'étudiant" : "Nouvel étudiant"}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="Nom"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Courriel" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Groupe" value={group} onChange={(e) => setGroup(e.target.value)} />
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    {selectedId ? (
                      confirmDelete ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-600 font-semibold">Confirmer la suppression ?</span>
                          <button onClick={removeStudent} className="bg-red-600 text-white rounded-lg px-3 py-2">Oui</button>
                          <button onClick={() => setConfirmDelete(false)} className="border rounded-lg px-3 py-2">Non</button>
                        </div>
                      ) : <button onClick={() => setConfirmDelete(true)} className="text-red-600 text-sm">Supprimer</button>
                    ) : <span></span>}
                    <button onClick={save} className="bg-gray-900 text-white rounded-lg px-4 py-2">Enregistrer</button>
                  </div>
                  {selectedId && (
                    <div className="mt-6 border-t pt-4">
                      <h3 className="font-semibold mb-2">Dossier d'évaluations</h3>
                      <ul className="divide-y">
                        {studentEvals.map((ev) => (
                          <li key={ev._id} className="py-2 flex justify-between items-center text-sm">
                            <div>{ev.date} • {ev.rubric?.taskTitle || ev.rubric?.title}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{ev.totalScore}/{ev.totalMax}</span>
                              <Link to={`/evaluations?load=${ev._id}&tab=corriger`} className="text-blue-600 hover:underline">Voir</Link>
                              <button onClick={() => removeEval(ev._id)} className="text-red-600 hover:underline">Suppr.</button>
                            </div>
                          </li>
                        ))}
                        {studentEvals.length === 0 && <li className="py-2 text-sm text-gray-500">Aucune évaluation.</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>

      </main>

      {purgeGroupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closePurgeGroupModal()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-group-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="purge-group-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
              Supprimer le groupe et tous les étudiants
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
              Le groupe <strong className="text-gray-900 dark:text-slate-200">« {purgeGroupModal} »</strong> et{" "}
              <strong>tous les étudiants</strong> qu’il contient seront effacés. Les{" "}
              <strong>évaluations</strong> et l’<strong>historique d’envois</strong> liés à ces étudiants seront aussi
              supprimés. Cette action est <strong>irréversible</strong>.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-800 dark:text-slate-200">
              Tapez le nom exact du groupe pour confirmer
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder={purgeGroupModal}
                autoComplete="off"
                autoFocus
              />
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-600"
                checked={purgeAckIrreversible}
                onChange={(e) => setPurgeAckIrreversible(e.target.checked)}
              />
              <span>Je comprends que cette suppression est définitive et que les données ne pourront pas être récupérées.</span>
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closePurgeGroupModal}
                disabled={purgeBusy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void executePurgeGroup()}
                disabled={
                  purgeBusy ||
                  !purgeAckIrreversible ||
                  purgeConfirmText.trim() !== purgeGroupModal.trim()
                }
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-900 dark:hover:bg-red-950"
              >
                {purgeBusy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
