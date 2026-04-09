import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import TopPageMenu from "../components/TopPageMenu";
import PageHeader from "../components/PageHeader";

function HubHeader() {
  return (
    <PageHeader
      icon="fa-chalkboard-user"
      iconBgClass="bg-blue-600"
      title="Espace classe"
      subtitle="Groupes, étudiants, suivi des évaluations et envoi des copies"
    />
  );
}

function HubTabs({ activeTab, setActiveTab }) {
  const tabs = [
    ["roster", "Classes & Étudiants", "fa-users-between-lines"],
    ["evaluations", "Évaluations", "fa-list-check"],
    ["deliveries", "Envois", "fa-paper-plane"],
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2.5 text-sm rounded-xl border transition-all ${
              activeTab === id
                ? "bg-blue-600 text-white border-blue-600 shadow"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <i className={`fa-solid ${icon} mr-2`}></i>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HubContextBar({ selectedGroup, setSelectedGroup, groupKeys, stats }) {
  const active = stats.find((s) => s.group === selectedGroup);
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-gray-600">Groupe actif</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 border border-blue-200 rounded-lg bg-white text-sm"
          >
            <option value="">Tous les groupes</option>
            {groupKeys.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <div className="text-gray-500">Étudiants</div>
            <div className="font-bold text-gray-800">{active?.students ?? "-"}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <div className="text-gray-500">Évaluations</div>
            <div className="font-bold text-gray-800">{active?.evaluations ?? "-"}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <div className="text-gray-500">Moyenne</div>
            <div className="font-bold text-gray-800">{active ? `${active.avgPct}%` : "-"}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <div className="text-gray-500">Envois sent/failed</div>
            <div className="font-bold text-gray-800">{active ? `${active.sent}/${active.failed}` : "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function evalStudentId(it) {
  if (!it?.studentId) return null;
  if (typeof it.studentId === "object") return String(it.studentId._id ?? "");
  return String(it.studentId);
}

function evalRubricId(it) {
  if (!it?.rubric) return null;
  if (typeof it.rubric === "object") return String(it.rubric._id ?? "");
  return String(it.rubric);
}

/** Si plusieurs copies pour le même étudiant et la même grille, on retient la plus récente par date. */
function findLatestEvalForStudentRubric(studentId, rubricId, itemsList) {
  const sid = String(studentId);
  const rid = String(rubricId);
  const matches = itemsList.filter((it) => {
    const eSid = evalStudentId(it);
    const eRid = evalRubricId(it);
    return eSid === sid && eRid === rid;
  });
  if (!matches.length) return null;
  matches.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""), "fr"));
  return matches[0];
}

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("roster");
  const [students, setStudents] = useState([]);
  const [groupDashboard, setGroupDashboard] = useState([]);
  const [items, setItems] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [emailTargets, setEmailTargets] = useState({ groups: [], exams: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [studentEvals, setStudentEvals] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [renameGroupTo, setRenameGroupTo] = useState("");
  const [draftGroups, setDraftGroups] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  /** Ligne d'examen (carte Envois) pour la modale détail corrigés / non corrigés */
  const [correctionModalRow, setCorrectionModalRow] = useState(null);
  const [emailBatchConfig, setEmailBatchConfig] = useState({
    group: "",
    rubricId: "",
    skipAlreadySent: true,
    allowResendFailed: true,
    delayMs: 700,
  });
  /** Tri du tableau « Suivi des évaluations » (onglet Évaluations du hub). */
  const [hubEvalSort, setHubEvalSort] = useState({ key: "name", dir: "asc" });

  /** Examens connus du serveur pour lesquels il existe au moins une évaluation (copie corrigée) dans le groupe sélectionné, ou dans n'importe quel groupe si « Tous ». */
  const examsForSend = useMemo(() => {
    const exams = emailTargets.exams || [];
    const rubricIdsWithCorrection = new Set();
    items.forEach((it) => {
      const sid = evalStudentId(it);
      if (!sid) return;
      const student = students.find((x) => String(x._id) === sid);
      if (!student) return;
      const g = student.group || "Sans groupe";
      if (selectedGroup && g !== selectedGroup) return;
      const rid = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
      if (rid) rubricIdsWithCorrection.add(rid);
    });
    return exams.filter((ex) => rubricIdsWithCorrection.has(String(ex.rubricId)));
  }, [selectedGroup, students, items, emailTargets.exams]);

  const selectedSendExam = useMemo(
    () => examsForSend.find((x) => String(x.rubricId) === String(emailBatchConfig.rubricId)),
    [examsForSend, emailBatchConfig.rubricId]
  );

  const [emailJob, setEmailJob] = useState({ jobId: "", status: "", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    try {
      const [data, dashboard, evals, targets, sends] = await Promise.all([
        api.listStudents(),
        api.getStudentGroupDashboard(),
        api.listEvaluations({ page: 1, limit: 2000 }),
        api.getEmailTargets(),
        api.listEmailDeliveries(),
      ]);
      setStudents(data);
      setGroupDashboard(dashboard || []);
      setItems(evals?.items || []);
      setEmailTargets(targets || { groups: [], exams: [] });
      setDeliveries(sends || []);
      setSelectedGroup((prev) => prev || targets?.groups?.[0] || "");
      setEmailBatchConfig((prev) => {
        const examIds = new Set((targets?.exams || []).map((e) => String(e.rubricId)));
        const rubricId = prev.rubricId && examIds.has(String(prev.rubricId)) ? prev.rubricId : "";
        return {
          ...prev,
          group: prev.group || targets?.groups?.[0] || "",
          rubricId,
        };
      });
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setEmailBatchConfig((prev) => {
      if (!prev.rubricId) return prev;
      const ok = examsForSend.some((e) => String(e.rubricId) === String(prev.rubricId));
      if (ok) return prev;
      return { ...prev, rubricId: "" };
    });
  }, [examsForSend]);

  const groupedStudents = useMemo(() => students.reduce((acc, s) => {
    const g = s.group || "Sans groupe";
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {}), [students]);
  const groupKeys = Object.keys(groupedStudents).sort();
  const allGroupKeys = Array.from(new Set([...groupKeys, ...draftGroups])).sort();
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

  const hubEvalTableRows = useMemo(() => {
    const rid = emailBatchConfig.rubricId;
    if (!rid) return [];
    return filteredStudents.map((s) => {
      const ev = findLatestEvalForStudentRubric(s._id, rid, items);
      const totalMax = ev?.totalMax ?? 0;
      const totalScore = ev?.totalScore ?? 0;
      const pct = totalMax > 0 ? (Number(totalScore) / Number(totalMax)) * 100 : null;
      const dateStr = ev?.date ? String(ev.date).slice(0, 10) : "";
      return {
        student: s,
        evaluation: ev,
        corrected: !!ev,
        pct,
        dateStr,
      };
    });
  }, [filteredStudents, items, emailBatchConfig.rubricId]);

  const hubEvalSortedRows = useMemo(() => {
    const rows = [...hubEvalTableRows];
    const { key, dir } = hubEvalSort;
    const mult = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "name":
          cmp = (a.student.name || "").localeCompare(b.student.name || "", "fr");
          break;
        case "status": {
          const va = a.corrected ? 1 : 0;
          const vb = b.corrected ? 1 : 0;
          cmp = va - vb;
          break;
        }
        case "date": {
          const da = a.dateStr;
          const db = b.dateStr;
          if (!da && !db) cmp = 0;
          else if (!da) cmp = 1;
          else if (!db) cmp = -1;
          else cmp = da.localeCompare(db);
          break;
        }
        case "score": {
          const na = a.pct == null ? -1 : a.pct;
          const nb = b.pct == null ? -1 : b.pct;
          cmp = na - nb;
          break;
        }
        default:
          cmp = 0;
      }
      return mult * cmp;
    });
    return rows;
  }, [hubEvalTableRows, hubEvalSort]);

  function toggleHubEvalSort(nextKey) {
    setHubEvalSort((prev) =>
      prev.key === nextKey ? { key: nextKey, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: nextKey, dir: "asc" }
    );
  }

  const enrollSendSummaries = useMemo(() => {
    if (!selectedGroup) return [];
    const groupStudents = students.filter((s) => (s.group || "Sans groupe") === selectedGroup);
    if (!groupStudents.length) return [];
    const groupStudentIds = new Set(groupStudents.map((s) => String(s._id)));
    const withEmailCount = groupStudents.filter((s) => s.email).length;

    return examsForSend.map((exam) => {
      const rubricId = String(exam.rubricId);
      const examKey = `${rubricId}:${exam.version ?? 1}`;

      const correctedIds = new Set();
      items.forEach((it) => {
        const sid = evalStudentId(it);
        if (!sid || !groupStudentIds.has(sid)) return;
        const rid = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
        if (rid === rubricId) correctedIds.add(sid);
      });

      const totalStudents = groupStudents.length;
      const correctedCount = correctedIds.size;
      const allCorrected = totalStudents > 0 && correctedCount === totalStudents;
      const noStudents = totalStudents === 0;

      const sentCopies = deliveries.filter(
        (d) => d.group === selectedGroup && d.examKey === examKey && d.status === "sent"
      ).length;

      return {
        examKey,
        rubricId,
        title: exam.taskTitle || exam.title,
        courseTitle: exam.title,
        version: exam.version,
        totalStudents,
        withEmailCount,
        correctedCount,
        allCorrected,
        sentCopies,
        noStudents,
      };
    });
  }, [selectedGroup, students, items, examsForSend, deliveries]);

  /** IDs ayant une évaluation pour l’examen sélectionné dans le hub (respecte le groupe actif si défini). */
  const correctedStudentIdsForHubExam = useMemo(() => {
    const rid = emailBatchConfig.rubricId;
    if (!rid) return null;
    const set = new Set();
    for (const it of items) {
      const sid = evalStudentId(it);
      if (!sid) continue;
      const st = students.find((s) => String(s._id) === sid);
      if (!st) continue;
      if (selectedGroup && (st.group || "Sans groupe") !== selectedGroup) continue;
      const rubId = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
      if (rubId === String(rid)) set.add(sid);
    }
    return set;
  }, [items, students, selectedGroup, emailBatchConfig.rubricId]);

  const correctionModalLists = useMemo(() => {
    if (!correctionModalRow || !selectedGroup) return { corrected: [], pending: [], title: "" };
    const rubricId = String(correctionModalRow.rubricId);
    const groupStudents = students.filter((s) => (s.group || "Sans groupe") === selectedGroup);
    const groupStudentIds = new Set(groupStudents.map((s) => String(s._id)));
    const correctedSet = new Set();
    for (const it of items) {
      const sid = evalStudentId(it);
      if (!sid || !groupStudentIds.has(sid)) continue;
      const rubId = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
      if (rubId === rubricId) correctedSet.add(sid);
    }
    const corrected = [];
    const pending = [];
    for (const s of groupStudents) {
      const id = String(s._id);
      if (correctedSet.has(id)) corrected.push(s);
      else pending.push(s);
    }
    const cmp = (a, b) => (a.name || "").localeCompare(b.name || "", "fr");
    corrected.sort(cmp);
    pending.sort(cmp);
    return {
      corrected,
      pending,
      title: correctionModalRow.title || "Examen",
    };
  }, [correctionModalRow, selectedGroup, students, items]);

  const visibleDeliveries = selectedGroup
    ? deliveries.filter((d) => d.group === selectedGroup)
    : deliveries;

  const visibleDeliveriesForExam = useMemo(() => {
    if (!emailBatchConfig.rubricId) return visibleDeliveries;
    const prefix = `${emailBatchConfig.rubricId}:`;
    return visibleDeliveries.filter((d) => String(d.examKey || "").startsWith(prefix));
  }, [visibleDeliveries, emailBatchConfig.rubricId]);

  function startNew() {
    setSelectedId(null);
    setName("");
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
    setName(s.name || "");
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
        await api.updateStudent(selectedId, { name, email, group });
        setSuccess("Étudiant modifié.");
      } else {
        await api.createStudent({ name, email, group });
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
    setName("");
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
  function openEmailSendModal() {
    setError("");
    if (!emailBatchConfig.rubricId) {
      setError("Sélectionnez d'abord un examen pour l'envoi.");
      return;
    }
    setEmailBatchConfig((prev) => ({
      ...prev,
      group: selectedGroup || prev.group,
    }));
    setShowEmailModal(true);
  }

  async function startEmailBatch() {
    try {
      if (!emailBatchConfig.rubricId) {
        setError("Aucun examen sélectionné.");
        return;
      }
      const { jobId } = await api.startEmailBatch({
        group: emailBatchConfig.group,
        rubricId: emailBatchConfig.rubricId,
        skipAlreadySent: emailBatchConfig.skipAlreadySent,
        allowResendFailed: emailBatchConfig.allowResendFailed,
        delayMs: Number(emailBatchConfig.delayMs || 700),
      });
      setEmailJob({ jobId, status: "queued", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 });
      setShowEmailModal(false);
      setSuccess("Envoi en lot démarré.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function retryFailed(jobId) {
    try {
      const res = await api.retryFailedEmailBatch(jobId, { delayMs: Number(emailBatchConfig.delayMs || 700) });
      if (res?.jobId) setEmailJob({ jobId: res.jobId, status: "queued", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 });
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  useEffect(() => {
    if (!emailJob.jobId) return undefined;
    const timer = setInterval(async () => {
      try {
        const progress = await api.getEmailBatchProgress(emailJob.jobId);
        setEmailJob((prev) => ({ ...prev, ...progress, jobId: emailJob.jobId }));
        if (progress.status === "completed" || progress.status === "failed") {
          clearInterval(timer);
          const sends = await api.listEmailDeliveries();
          setDeliveries(sends || []);
        }
      } catch {
        clearInterval(timer);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [emailJob.jobId]);

  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans flex flex-col">
      <HubHeader />
      <TopPageMenu />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-4">
        <HubContextBar selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} groupKeys={allGroupKeys} stats={displayedGroupDashboard} />
        <HubTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">{success}</div>}

        {activeTab === "roster" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <h2 className="text-base font-bold mb-3">Groupes</h2>
                <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
                  {displayedGroupDashboard.map((g) => (
                    <div key={g.group} className={`rounded-xl border p-3 ${selectedGroup === g.group ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                      <div className="flex justify-between items-start gap-2">
                        <button type="button" onClick={() => setSelectedGroup(g.group)} className="font-semibold text-sm text-left">
                          {g.group}
                        </button>
                        <button type="button" onClick={() => clearGroup(g.group)} className="text-xs text-red-600 hover:underline">Vider</button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">{g.students} étu. • {g.evaluations} évals.</p>
                    </div>
                  ))}
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
              </div>
            </div>

            <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex gap-2 mb-3">
                <button onClick={startNew} className="flex-1 text-sm border rounded-lg py-2">Ajouter</button>
                <button onClick={startBulk} className="flex-1 text-sm border rounded-lg py-2">Importer</button>
              </div>
              <h2 className="text-base font-bold mb-2">Étudiants {selectedGroup ? `• ${selectedGroup}` : ""}</h2>
              <div className="mb-3">
                <label className="text-xs text-gray-600 block">Examen (suivi des corrections)</label>
                <select
                  className="mt-1 w-full text-sm border rounded-lg px-2 py-1.5 bg-white"
                  value={emailBatchConfig.rubricId}
                  onChange={(e) => setEmailBatchConfig((prev) => ({ ...prev, rubricId: e.target.value }))}
                >
                  <option value="">— Aucun examen —</option>
                  {examsForSend.map((ex) => (
                    <option key={`${ex.rubricId}-${ex.version ?? 1}`} value={String(ex.rubricId)}>
                      {ex.taskTitle || ex.title} (v{ex.version ?? 1})
                    </option>
                  ))}
                </select>
                {!selectedGroup && (
                  <p className="text-[11px] text-gray-400 mt-1">Avec « Tous les groupes », le suivi s’applique à chaque étudiant selon son groupe.</p>
                )}
                {selectedGroup && examsForSend.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">Aucun examen avec correction dans ce groupe pour l’instant.</p>
                )}
              </div>
              <div className="space-y-1 max-h-[68vh] overflow-y-auto">
                {filteredStudents.map((s) => (
                  <button key={s._id} onClick={() => selectStudent(s)} className={`w-full text-left p-2 rounded-lg ${selectedId === s._id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.email || "Sans email"}</div>
                      </div>
                      {emailBatchConfig.rubricId && correctedStudentIdsForHubExam && (
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            correctedStudentIdsForHubExam.has(String(s._id)) ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {correctedStudentIdsForHubExam.has(String(s._id)) ? "Corrigé" : "À corriger"}
                        </span>
                      )}
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
                    Une ligne par étudiant : <strong>nom seul</strong>, ou <strong>nom</strong> suivi d’une tabulation, d’un point-virgule ou d’une virgule (si le courriel contient <code className="bg-gray-100 px-0.5 rounded">@</code>) puis le <strong>courriel</strong>.
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
                    <input className="border rounded-lg px-3 py-2" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                              <Link to={`/evaluations?load=${ev._id}`} className="text-blue-600 hover:underline">Voir</Link>
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
        )}

        {activeTab === "evaluations" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Suivi des évaluations {selectedGroup ? `• ${selectedGroup}` : ""}</h2>
              <button type="button" onClick={() => navigate("/evaluations")} className="text-sm text-blue-600 hover:text-blue-800">
                Ouvrir l&apos;éditeur
              </button>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 mb-4">
              <label htmlFor="hub-eval-exam-select" className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                Examen
              </label>
              <select
                id="hub-eval-exam-select"
                className="w-full max-w-xl text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm"
                value={emailBatchConfig.rubricId}
                onChange={(e) => setEmailBatchConfig((prev) => ({ ...prev, rubricId: e.target.value }))}
              >
                <option value="">— Choisir un examen —</option>
                {examsForSend.map((ex) => (
                  <option key={`ev-${ex.rubricId}-${ex.version ?? 1}`} value={String(ex.rubricId)}>
                    {ex.taskTitle || ex.title} (v{ex.version ?? 1})
                  </option>
                ))}
              </select>
              {!emailBatchConfig.rubricId && (
                <p className="text-sm text-gray-700 mt-3 rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3">
                  Sélectionnez un examen pour afficher le tableau : une ligne par étudiant du périmètre actif (groupe ou tous), avec statut, date, note et actions.
                </p>
              )}
              {emailBatchConfig.rubricId && examsForSend.length === 0 && (
                <p className="text-xs text-amber-800 mt-2">Aucun examen avec correction dans ce périmètre — importez ou corrigez d&apos;abord une copie.</p>
              )}
            </div>

            {emailBatchConfig.rubricId && (
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[640px]">
                    <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("name")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-700 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                          >
                            Étudiant
                            {hubEvalSort.key === "name" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-gray-400 text-xs" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("status")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-700 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                          >
                            Statut
                            {hubEvalSort.key === "status" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-gray-400 text-xs" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("date")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-700 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                          >
                            Date
                            {hubEvalSort.key === "date" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-gray-400 text-xs" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("score")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-700 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                          >
                            Résultat
                            {hubEvalSort.key === "score" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-gray-400 text-xs" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hubEvalSortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Aucun étudiant pour ce filtre (groupe actif ou liste vide).
                          </td>
                        </tr>
                      ) : (
                        hubEvalSortedRows.map((row) => (
                          <tr key={row.student._id} className="even:bg-slate-50/60 hover:bg-blue-50/40 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{row.student.name}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  row.corrected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {row.corrected ? "Corrigé" : "À corriger"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 tabular-nums">{row.dateStr || "—"}</td>
                            <td className="px-4 py-3">
                              {row.evaluation ? (
                                <span className="tabular-nums">
                                  <span className="font-semibold text-blue-800">
                                    {row.evaluation.totalScore}/{row.evaluation.totalMax}
                                  </span>
                                  {row.pct != null && (
                                    <span className="text-gray-500 ml-2">({Math.round(row.pct)}%)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.evaluation ? (
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Link
                                    to={`/evaluations?load=${row.evaluation._id}`}
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    Voir
                                  </Link>
                                  <Link
                                    to={`/evaluations?load=${row.evaluation._id}&download=true`}
                                    className="text-gray-700 hover:underline"
                                  >
                                    PDF
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => removeEval(row.evaluation._id)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Suppr.
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "deliveries" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Envois de copies</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedGroup
                    ? `Groupe « ${selectedGroup} » — cliquez une carte d’examen pour la sélectionner, puis « Nouvel envoi »`
                    : "Tous les groupes — sélectionnez un groupe pour le détail par examen"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/admin/users" className="text-sm text-emerald-700 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-50">Administration</Link>
                <button
                  type="button"
                  onClick={openEmailSendModal}
                  disabled={!emailBatchConfig.rubricId || !examsForSend.length}
                  title={!emailBatchConfig.rubricId ? "Sélectionnez d’abord un examen (carte)" : ""}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg"
                >
                  <i className="fa-solid fa-paper-plane mr-2"></i>Nouvel envoi
                </button>
              </div>
            </div>

            {!selectedGroup && (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 text-amber-900 text-sm px-4 py-3">
                Choisissez un <strong>groupe actif</strong> dans la barre du haut pour afficher, par examen, combien d&apos;étudiants sont corrigés et combien de copies ont été envoyées.
              </div>
            )}

            {selectedGroup && examsForSend.length === 0 && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm px-4 py-3">
                Aucun examen avec des corrections pour le groupe « {selectedGroup} ». Seuls les examens avec au moins une copie corrigée apparaissent en cartes.
              </div>
            )}

            {selectedGroup && enrollSendSummaries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {enrollSendSummaries.map((row) => (
                  <div
                    key={row.examKey}
                    className={`rounded-xl border bg-gray-50/80 transition-all ${
                      String(emailBatchConfig.rubricId) === String(row.rubricId)
                        ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/50"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setEmailBatchConfig((prev) => ({ ...prev, rubricId: row.rubricId }));
                      }}
                      className="w-full text-left p-4 pb-2 rounded-t-xl hover:bg-white/40 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-gray-900">{row.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {[row.courseTitle && row.courseTitle !== row.title ? row.courseTitle : null, `v${row.version}`].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                            row.noStudents ? "bg-gray-100 text-gray-600" : row.allCorrected ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {row.noStudents ? "Aucun étudiant" : row.allCorrected ? "Tous corrigés" : "Correction incomplète"}
                        </span>
                      </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2 text-sm px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => setCorrectionModalRow(row)}
                        className="rounded-lg bg-white border border-gray-100 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
                        title="Voir la liste des étudiants corrigés et à corriger"
                      >
                        <div className="text-xs text-gray-500 uppercase">Étudiants corrigés</div>
                        <div className="font-bold text-gray-900">
                          {row.correctedCount}/{row.totalStudents}
                        </div>
                        <div className="text-[10px] text-blue-600 mt-0.5">Cliquer pour le détail</div>
                      </button>
                      <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <div className="text-xs text-gray-500 uppercase">Copies envoyées</div>
                        <div className="font-bold text-gray-900">{row.sentCopies}</div>
                        <div className="text-[10px] text-gray-400">{row.withEmailCount} avec email</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!!emailJob.jobId && (
              <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm">
                <div className="font-semibold text-gray-700 mb-1">Job {emailJob.jobId} ({emailJob.status || "queued"})</div>
                <div>{emailJob.processed}/{emailJob.total} traités • envoyés {emailJob.sent || 0} • échecs {emailJob.failed || 0} • ignorés {emailJob.skipped || 0}</div>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Historique des envois</h3>
              {emailBatchConfig.rubricId && (
                <span className="text-xs text-gray-500">Filtré sur l&apos;examen sélectionné</span>
              )}
            </div>
            <ul className="divide-y max-h-[60vh] overflow-y-auto">
              {visibleDeliveriesForExam.map((d) => {
                const examLabel = d.evaluationId?.rubric?.taskTitle || d.evaluationId?.rubric?.title || d.examKey;
                return (
                  <li key={d._id} className="py-2 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium">{d.studentId?.name || d.evaluationId?.studentName || "Étudiant"}</div>
                      <div className="text-xs text-gray-500">{d.group || "Sans groupe"} · {examLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${d.status === "sent" ? "text-green-600" : d.status === "failed" ? "text-red-600" : "text-gray-500"}`}>{d.status}</div>
                      {d.status === "failed" && <button type="button" onClick={() => retryFailed(d.jobId)} className="text-xs text-blue-600 hover:underline">Relancer erreurs</button>}
                    </div>
                  </li>
                );
              })}
              {visibleDeliveriesForExam.length === 0 && (
                <li className="py-2 text-sm text-gray-500">
                  {visibleDeliveries.length === 0
                    ? `Aucun envoi journalisé${selectedGroup ? " pour ce groupe" : ""}.`
                    : "Aucun envoi pour l'examen sélectionné."}
                </li>
              )}
            </ul>
          </div>
        )}
      </main>

      {correctionModalRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setCorrectionModalRow(null)}
          role="presentation"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Étudiants corrigés · détail</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {correctionModalLists.title}
                  {selectedGroup ? ` · groupe « ${selectedGroup} »` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setCorrectionModalRow(null)} className="text-gray-400 hover:text-gray-600" aria-label="Fermer">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
              <div className="rounded-xl border border-green-100 bg-green-50/40 p-3">
                <h3 className="text-sm font-semibold text-green-900 mb-2">Corrigés ({correctionModalLists.corrected.length})</h3>
                <ul className="text-sm space-y-1 max-h-[40vh] overflow-y-auto">
                  {correctionModalLists.corrected.map((s) => (
                    <li key={s._id} className="text-gray-800 py-0.5 border-b border-green-100/50 last:border-0">
                      {s.name}
                      {s.email ? <span className="block text-xs text-gray-500">{s.email}</span> : null}
                    </li>
                  ))}
                  {correctionModalLists.corrected.length === 0 && <li className="text-xs text-gray-500">Aucun pour cet examen.</li>}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">Pas encore corrigés ({correctionModalLists.pending.length})</h3>
                <ul className="text-sm space-y-1 max-h-[40vh] overflow-y-auto">
                  {correctionModalLists.pending.map((s) => (
                    <li key={s._id} className="text-gray-800 py-0.5 border-b border-amber-100/50 last:border-0">
                      {s.name}
                      {s.email ? <span className="block text-xs text-gray-500">{s.email}</span> : null}
                    </li>
                  ))}
                  {correctionModalLists.pending.length === 0 && <li className="text-xs text-gray-500">Tous sont corrigés.</li>}
                </ul>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0 flex justify-end">
              <button type="button" onClick={() => setCorrectionModalRow(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && setShowEmailModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Envoi des copies par lot</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase text-emerald-800 mb-1">Examen</div>
                <div className="font-medium text-gray-900">
                  {selectedSendExam ? `${selectedSendExam.taskTitle || selectedSendExam.title} (v${selectedSendExam.version})` : "—"}
                </div>
                {selectedSendExam?.title && selectedSendExam?.taskTitle && selectedSendExam.title !== selectedSendExam.taskTitle && (
                  <div className="text-xs text-gray-600 mt-1">{selectedSendExam.title}</div>
                )}
              </div>
              <label className="text-sm block">Groupe destinataire
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={emailBatchConfig.group} onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, group: e.target.value })}>
                  {emailTargets.groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emailBatchConfig.skipAlreadySent} onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, skipAlreadySent: e.target.checked })} />Ignorer les copies déjà envoyées</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emailBatchConfig.allowResendFailed} onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, allowResendFailed: e.target.checked })} />Relancer les copies en erreur</label>
              <label className="text-sm">Délai entre chaque email (ms)
                <input type="number" min="0" max="10000" className="mt-1 w-full border rounded-lg px-3 py-2" value={emailBatchConfig.delayMs} onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, delayMs: Number(e.target.value || 0) })} />
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">Fermer</button>
              <button onClick={startEmailBatch} className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Lancer l'envoi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
