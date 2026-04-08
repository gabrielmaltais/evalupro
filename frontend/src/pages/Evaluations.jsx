import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getUserFromToken } from "../lib/api";
import TopPageMenu from "../components/TopPageMenu";
import PageHeader from "../components/PageHeader";

function evalItemStudentId(it) {
  if (!it?.studentId) return null;
  if (typeof it.studentId === "object") return String(it.studentId._id ?? "");
  return String(it.studentId);
}

function evalItemRubricId(it) {
  if (!it?.rubric) return null;
  if (typeof it.rubric === "object") return String(it.rubric._id ?? "");
  return String(it.rubric);
}

/** Liste déroulante étudiants avec icônes (le <select> natif ne permet pas le HTML dans les options). */
function StudentSelectWithIcons({
  students,
  valueStudentId,
  onSelectStudent,
  correctedIdsForExam,
  hasActiveRubric,
  wrapperClassName = "relative flex-1 min-w-0",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const groupedStudents = useMemo(() => {
    const acc = {};
    for (const s of students) {
      const g = s.group || "Sans groupe";
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
    }
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([groupName, list]) => [
        groupName,
        [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr")),
      ]);
  }, [students]);

  const showStatus = Boolean(hasActiveRubric && correctedIdsForExam);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const selected = students.find((s) => String(s._id) === String(valueStudentId));

  const pick = useCallback(
    (student) => {
      if (!student) {
        onSelectStudent({ studentId: "", studentName: "" });
      } else {
        onSelectStudent({ studentId: student._id, studentName: student.name || "" });
      }
      setOpen(false);
    },
    [onSelectStudent]
  );

  return (
    <div className={wrapperClassName} ref={wrapRef}>
      <button
        type="button"
        id="student-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 box-border border border-gray-300 rounded-lg text-left text-sm flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              {showStatus && (
                <span className="w-5 shrink-0 flex justify-center" aria-hidden>
                  {correctedIdsForExam.has(String(selected._id)) ? (
                    <i className="fa-solid fa-check text-green-600 text-sm" title="Corrigé pour cet examen" />
                  ) : (
                    <i className="fa-regular fa-circle text-amber-500 text-sm" title="Pas encore corrigé pour cet examen" />
                  )}
                </span>
              )}
              <span className="truncate font-medium text-gray-900">{selected.name}</span>
            </>
          ) : (
            <span className="text-gray-500">— Utilisateur libre —</span>
          )}
        </span>
        <i className={`fa-solid fa-chevron-down text-gray-400 text-xs shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
          role="listbox"
          aria-labelledby="student-select-trigger"
        >
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!valueStudentId}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 text-gray-600 border-b border-gray-100"
              onClick={() => pick(null)}
            >
              — Utilisateur libre —
            </button>
          </li>
          {groupedStudents.map(([groupName, groupList]) => (
            <li key={groupName} role="none" className="pt-1">
              <div className="px-3 py-1 text-[11px] font-bold italic text-gray-500 tracking-wide">{groupName}</div>
              <ul role="none">
                {groupList.map((s) => {
                  const sid = String(s._id);
                  const corrected = showStatus && correctedIdsForExam.has(sid);
                  return (
                    <li key={s._id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={String(valueStudentId) === sid}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2.5 ${
                          String(valueStudentId) === sid ? "bg-blue-50/80" : ""
                        }`}
                        onClick={() => pick(s)}
                        title={showStatus ? (corrected ? "Corrigé pour cet examen" : "Pas encore corrigé") : undefined}
                      >
                        {showStatus ? (
                          <span className="w-5 shrink-0 flex justify-center" aria-hidden>
                            {corrected ? (
                              <i className="fa-solid fa-check text-green-600 text-sm" />
                            ) : (
                              <i className="fa-regular fa-circle text-amber-500 text-sm" />
                            )}
                          </span>
                        ) : (
                          <span className="w-5 shrink-0" aria-hidden />
                        )}
                        <span className="truncate text-gray-900">{s.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Evaluations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rubrics, setRubrics] = useState([]);
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]); // Historique
  const [form, setForm] = useState({ studentId: "", studentName: "", date: new Date().toISOString().slice(0, 10), generalComment: "", rubric: "" });
  const [scores, setScores] = useState({});
  const [subScores, setSubScores] = useState({});
  const [touched, setTouched] = useState({});
  const [comments, setComments] = useState({});
  const [showComment, setShowComment] = useState({});
  const [showDatePdf, setShowDatePdf] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const pdfTemplateRef = useRef(null);

  async function refresh() {
    const [evaluations, rubricList, studentList] = await Promise.all([api.listEvaluations(), api.listRubrics(), api.listStudents()]);
    setItems(evaluations.items || []);
    setRubrics(rubricList);
    setStudents(studentList);
    if (!form.rubric && rubricList[0]) setForm((f) => ({ ...f, rubric: rubricList[0]._id }));
  }


  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
  }, []);

  const selectedRubric = rubrics.find((r) => r._id === form.rubric);

  /** Étudiants (id) ayant déjà au moins une évaluation pour la grille / examen actif */
  const correctedStudentIdsForActiveExam = useMemo(() => {
    const rid = form.rubric;
    if (!rid) return null;
    const set = new Set();
    for (const it of items) {
      const sid = evalItemStudentId(it);
      if (!sid) continue;
      const rubId = evalItemRubricId(it);
      if (rubId === String(rid)) set.add(sid);
    }
    return set;
  }, [items, form.rubric]);

  const [studentPickerGroup, setStudentPickerGroup] = useState("");

  const studentGroupKeys = useMemo(() => {
    const set = new Set();
    for (const s of students) set.add(s.group || "Sans groupe");
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [students]);

  const studentsForPicker = useMemo(() => {
    let list = !studentPickerGroup
      ? students
      : students.filter((s) => (s.group || "Sans groupe") === studentPickerGroup);
    if (form.studentId) {
      const cur = students.find((s) => String(s._id) === String(form.studentId));
      if (cur && !list.some((s) => String(s._id) === String(cur._id))) {
        list = [...list, cur];
      }
    }
    return list;
  }, [students, studentPickerGroup, form.studentId]);

  function onStudentPickerGroupChange(g) {
    setStudentPickerGroup(g);
    setForm((f) => {
      if (!f.studentId) return f;
      const st = students.find((s) => String(s._id) === String(f.studentId));
      if (!st) return { ...f, studentId: "", studentName: "" };
      const grp = st.group || "Sans groupe";
      if (g && grp !== g) return { ...f, studentId: "", studentName: "" };
      return f;
    });
  }

  let totalMax = 0;
  let totalScore = 0;

  if (selectedRubric && selectedRubric.criteria) {
    selectedRubric.criteria.forEach((c) => {
      totalMax += c.weight || 0;
      totalScore += scores[c.id || c._id] || 0;
    });
  }

  const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const barColor = pct < 60 ? 'bg-red-500' : pct < 80 ? 'bg-yellow-400' : 'bg-green-500';

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstance.current) {
      chartInstance.current.data.datasets[0].data = [totalScore, Math.max(0, totalMax - totalScore)];
      chartInstance.current.data.datasets[0].backgroundColor = [
        pct < 60 ? '#ef4444' : pct < 80 ? '#facc15' : '#22c55e',
        '#e2e8f0'
      ];
      chartInstance.current.update();
    } else if (window.Chart) {
      chartInstance.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Acquis', 'Manquant'],
          datasets: [{
            data: [totalScore, Math.max(0, totalMax - totalScore)],
            backgroundColor: ['#3b82f6', '#e2e8f0'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          cutout: '75%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }
  }, [totalScore, totalMax, pct]);

  async function loadEvaluation(id) {
    try {
      const data = await api.getEvaluation(id);
      setForm({
        _id: data._id,
        studentId: data.studentId || "",
        studentName: data.studentName || "",
        date: data.date.slice(0, 10),
        generalComment: data.generalComment || "",
        rubric: typeof data.rubric === 'object' ? data.rubric._id : data.rubric
      });
      setScores(data.scores || {});
      setSubScores(data.subScores || {});
      // Marquer comme touchés tous les critères qui ont un score ou des subScores
      const restoredTouched = {};
      if (data.scores) Object.keys(data.scores).forEach(k => { restoredTouched[k] = true; });
      if (data.subScores) Object.keys(data.subScores).forEach(k => { restoredTouched[k] = true; });
      setTouched(restoredTouched);
      setComments(data.comments || {});
      window.scrollTo(0, 0);
    } catch (e) {
      setError("Impossible de charger l'évaluation.");
    }
  }

  async function deleteEval(id) {
    if (!window.confirm('Supprimer cette évaluation ?')) return;
    try {
      await api.deleteEvaluation(id);
      if (form._id === id) {
        setForm({ studentId: "", studentName: "", date: new Date().toISOString().slice(0, 10), generalComment: "", rubric: rubrics[0]?._id });
        setScores({});
        setSubScores({});
        setTouched({});
        setComments({});
      }
      refresh();
    } catch (e) {
      setError("Erreur lors de la suppression");
    }
  }

  const [autoDownload, setAutoDownload] = useState(false);

  useEffect(() => {
    const loadId = searchParams.get("load");
    const dl = searchParams.get("download");
    if (loadId) {
      loadEvaluation(loadId);
      if (dl === "true") setAutoDownload(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (autoDownload && form._id) {
      setTimeout(() => {
        generatePDF();
        setAutoDownload(false);
      }, 500);
    }
  }, [form._id, autoDownload]);

  async function saveEval() {
    setError("");
    try {
      if (form._id) {
        await api.updateEvaluation(form._id, { ...form, scores, subScores, comments });
      } else {
        const res = await api.createEvaluation({ ...form, scores, subScores, comments });
        setForm(f => ({ ...f, _id: res._id }));
      }
      await refresh();
      return true;
    } catch (err) {
      setError(String(err.message || err));
      return false;
    }
  }

  async function handleCreate(e) {
    if (e) e.preventDefault();
    if (await saveEval()) {
      alert("Évaluation enregistrée avec succès !");
    }
  }

  async function handleDownloadPDF() {
    setError("");
    if (!form.studentName) { setError("Veuillez sélectionner un étudiant."); return; }
    const success = await saveEval();
    if (success) {
      generatePDF();
    }
  }

  function handleScore(id, val) {
    setScores(s => ({ ...s, [id]: parseFloat(val) }));
    setTouched(t => ({ ...t, [id]: true }));
  }

  function handleLevelClick(cid, criterion, lvl) {
    const val = criterion.weight * lvl.maxPct;
    setScores(s => ({ ...s, [cid]: parseFloat(val) }));
    setTouched(t => ({ ...t, [cid]: true }));

    // Si le critère a des sous-critères, gérer les cases auto
    if (criterion.subCriteria && criterion.subCriteria.length > 0) {
      const sortedLevels = [...(criterion.levels || [])].sort((a, b) => a.maxPct - b.maxPct);
      const isHighest = sortedLevels.length > 0 && lvl.maxPct >= sortedLevels[sortedLevels.length - 1].maxPct;
      const isLowest = sortedLevels.length > 0 && lvl.maxPct <= sortedLevels[0].maxPct;

      if (isHighest) {
        // Cocher toutes les cases
        const allChecked = {};
        criterion.subCriteria.forEach(sc => { allChecked[sc.id] = true; });
        setSubScores(prev => ({ ...prev, [cid]: allChecked }));
      } else if (isLowest) {
        // Décocher toutes les cases
        setSubScores(prev => ({ ...prev, [cid]: {} }));
      }
      // Pour les niveaux intermédiaires, on laisse les cases telles quelles
    }
  }

  function handleSubScore(cid, scId, checked, criterion) {
    const newCState = { ...(subScores[cid] || {}), [scId]: checked };
    setSubScores(prev => ({ ...prev, [cid]: newCState }));
    setTouched(t => ({ ...t, [cid]: true }));

    // Recalculer le score en sommant les sous-critères cochés
    let total = 0;
    criterion.subCriteria.forEach(sc => {
      if (newCState[sc.id]) total += sc.pts;
    });
    // Plafonner au poids maximal du critère
    setScores(s => ({ ...s, [cid]: Math.min(Math.max(0, total), criterion.weight) }));
  }

  function generatePDF() {
    if (!window.html2pdf || !pdfTemplateRef.current) return;
    const template = pdfTemplateRef.current;
    const content = template.querySelector('#pdf-content');

    template.classList.remove('hidden');
    void template.offsetWidth; // force reflow

    const baseRubricTitle = (selectedRubric?.taskTitle || selectedRubric?.title || 'Evaluation').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_');
    const baseStudentName = (form.studentName || 'Etudiant').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_');

    const opt = {
      margin: 0.5,
      filename: `${baseRubricTitle}-${baseStudentName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, scrollY: 0, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    setTimeout(() => {
      window.html2pdf().set(opt).from(content).save().then(() => {
        template.classList.add('hidden');
      });
    }, 100);
  }

  return (
    <>
      <PageHeader
        icon="fa-graduation-cap"
        iconBgClass="bg-blue-600"
        title="ÉvaluPro"
        subtitle="Plateforme d'évaluation"
        showBack={false}
      />
      <TopPageMenu inHeader />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Evaluation Form */}
        <div className="lg:col-span-8 space-y-6">
          <section className="-mt-2">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-2.5 sm:p-3">
              <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
                <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-1">Examen actif</label>
                  <div className="mb-2">
                    <div className="text-lg font-bold text-gray-900 leading-tight truncate">
                      {selectedRubric?.taskTitle || selectedRubric?.title || "Aucun examen sélectionné"}
                    </div>
                    <div className="text-[12px] uppercase tracking-wide text-gray-500 font-semibold truncate">
                      {selectedRubric?.title && selectedRubric?.taskTitle
                        ? selectedRubric.title
                        : "Sélectionnez une grille pour commencer"}
                    </div>
                  </div>
                  <select
                    value={form.rubric}
                    onChange={(e) => setForm({ ...form, rubric: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs sm:text-sm outline-none bg-white font-semibold text-gray-800"
                  >
                    <option value="">-- Choisir une grille --</option>
                    {rubrics.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.taskTitle || r.title} (v{r.version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-x-4 lg:items-start">
              <div className="lg:col-span-3">
                <label htmlFor="eval-student-group" className="block text-sm font-medium text-gray-700 mb-1 min-h-[1.25rem]">
                  Groupe
                </label>
                <select
                  id="eval-student-group"
                  value={studentPickerGroup}
                  onChange={(e) => onStudentPickerGroupChange(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="">Tous les groupes</option>
                  {studentGroupKeys.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-5 min-w-0">
                <label htmlFor="student-select-trigger" className="block text-sm font-medium text-gray-700 mb-1 min-h-[1.25rem]">
                  Étudiant
                </label>
                <StudentSelectWithIcons
                  students={studentsForPicker}
                  valueStudentId={form.studentId}
                  onSelectStudent={({ studentId, studentName }) =>
                    setForm((f) => ({ ...f, studentId, studentName }))
                  }
                  correctedIdsForExam={correctedStudentIdsForActiveExam}
                  hasActiveRubric={Boolean(form.rubric)}
                  wrapperClassName="relative w-full min-w-0"
                />
                {form.rubric && (
                  <p className="text-xs text-gray-500 mt-2 flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-x-4 sm:gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fa-solid fa-check text-green-600 text-xs shrink-0" aria-hidden />
                      copie déjà enregistrée pour l’examen actif
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fa-regular fa-circle text-amber-500 text-xs shrink-0" aria-hidden />
                      pas encore de copie pour cet examen
                    </span>
                  </p>
                )}
              </div>
              <div className="lg:col-span-4 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1 min-h-[1.25rem]" htmlFor="eval-date-input">
                  Date de l&apos;évaluation
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
                  <input
                    id="eval-date-input"
                    type="date"
                    className="w-full sm:flex-1 min-w-0 h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm box-border"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                  <label className="flex h-10 shrink-0 items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 rounded-lg cursor-pointer hover:bg-gray-100 transition box-border whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showDatePdf}
                      onChange={(e) => setShowDatePdf(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                    />
                    Date sur le PDF
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {selectedRubric && selectedRubric.criteria && selectedRubric.criteria.map((c, i) => {
              const cid = c.id || c._id || String(i);
              const currentScore = scores[cid] || 0;
              const pctC = currentScore / (c.weight || 1);

              let descText = "En attente d'évaluation...";
              if (currentScore > 0 || scores[cid] === 0) {
                if (c.levels && c.levels.length > 0) {
                  const sortedLevels = [...c.levels].sort((a, b) => a.maxPct - b.maxPct);
                  let matchedLevel = sortedLevels[0];
                  for (const lvl of sortedLevels) {
                    if (pctC >= lvl.maxPct) matchedLevel = lvl;
                  }
                  descText = matchedLevel.desc || "Score attribué";
                } else {
                  descText = "Score attribué";
                }
              }

              return (
                <div key={cid} className={`bg-white rounded-xl shadow-sm border-l-8 ${c.color || 'border-blue-500'} border-y border-r border-gray-200 overflow-hidden transition-all hover:shadow-md`}>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{c.title}</h3>
                        <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">Pondération : {c.weight} pts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-blue-600">{currentScore}</span>
                        <span className="text-gray-400 text-sm">/ {c.weight}</span>
                        <button onClick={() => setShowComment(s => ({ ...s, [cid]: !s[cid] }))} className="ml-2 text-gray-400 hover:text-blue-500 transition"><i className="fa-regular fa-comment-dots text-xl"></i></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="space-y-3">
                        {c.levels && c.levels.length > 0 && (
                          <div className={`grid gap-2 ${c.levels.length === 2 ? 'grid-cols-2' : c.levels.length === 4 ? 'grid-cols-2 md:grid-cols-4' : c.levels.length === 5 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-1 md:grid-cols-3'}`}>
                            {c.levels.map((lvl, lnum) => {
                              const colorType = lvl.maxPct < 0.5 ? 'red' : lvl.maxPct < 0.8 ? 'yellow' : 'green';
                              const btnClass = colorType === 'red' ? 'border-red-200 text-red-600 hover:bg-red-50' : colorType === 'yellow' ? 'border-yellow-300 text-yellow-600 hover:bg-yellow-50' : 'border-green-200 text-green-600 hover:bg-green-50';
                              return (
                                <button key={lnum} onClick={() => handleLevelClick(cid, c, lvl)} className={`w-full py-2 px-1 text-xs font-semibold rounded border transition ${btnClass} leading-tight`}>
                                  {lvl.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="relative pt-4 pb-2">
                          <input type="range" min="0" max={c.weight || 10} step="0.5" value={currentScore} className="w-full h-2 accent-blue-600 cursor-pointer" onChange={e => handleScore(cid, e.target.value)} />
                        </div>

                        {c.subCriteria && c.subCriteria.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                            {c.subCriteria.map(sc => {
                              const isChecked = subScores[cid]?.[sc.id] || false;
                              return (
                                <label key={sc.id} className={`flex items-start gap-3 p-2 rounded cursor-pointer transition border ${isChecked ? 'border-purple-200 bg-purple-50/50' : 'border-transparent hover:border-gray-100 hover:bg-gray-50'}`}>
                                  <input type="checkbox" checked={isChecked} onChange={e => handleSubScore(cid, sc.id, e.target.checked, c)} className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 flex-shrink-0" />
                                  <div className="flex flex-col">
                                    <span className={`text-sm ${isChecked ? 'text-purple-700 font-semibold' : 'text-gray-700'}`}>{sc.label}</span>
                                    <span className="text-xs text-gray-400">Valeur: {sc.pts > 0 ? '+' : ''}{sc.pts} pts</span>
                                    {!isChecked && sc.feedback && touched[cid] && <p className="text-xs text-red-500 mt-1 italic">⚠ {sc.feedback}</p>}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}

                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[80px] flex flex-col justify-center">
                        <p className="text-sm text-gray-600 italic leading-snug">{descText}</p>
                        {c.subCriteria && c.subCriteria.length > 0 && touched[cid] && (() => {
                          const missingFeedbacks = c.subCriteria.filter(sc => !subScores[cid]?.[sc.id] && sc.feedback).map(sc => sc.feedback);
                          return missingFeedbacks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                              {missingFeedbacks.map((fb, fbI) => <p key={fbI} className="text-xs text-red-500">✗ {fb}</p>)}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {showComment[cid] && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase">Commentaire spécifique</label>
                        <textarea className="w-full mt-1 p-2 border border-gray-300 rounded text-sm outline-none" rows="2" value={comments[cid] || ""} onChange={e => setComments(s => ({ ...s, [cid]: e.target.value }))}></textarea>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Synthèse & Commentaires Généraux</h3>
            </div>
            <textarea rows="6" className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Observations générales sur le travail..." value={form.generalComment} onChange={e => setForm({ ...form, generalComment: e.target.value })}></textarea>
          </div>

          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{form.studentId ? `Historique de l'étudiant` : `Historique Récent`}</h3>
            <ul className="divide-y divide-gray-100">
              {(form.studentId ? items.filter(it => it.studentId === form.studentId) : items).slice(0, 10).map((it) => (
                <li key={it._id} className="py-2 flex justify-between items-center group">
                  <div className="flex-1 cursor-pointer" onClick={() => loadEvaluation(it._id)}>
                    <p className="text-sm text-gray-800 hover:text-blue-600 transition"><strong>{it.studentName}</strong> <span className="text-gray-400 mx-2">•</span> {it.date}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-blue-600">{it.totalScore}/{it.totalMax}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteEval(it._id); }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition" title="Supprimer">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="py-2 text-sm text-gray-500 italic">Aucune évaluation</li>}
            </ul>
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start space-y-6">
          <div className="sticky top-24 space-y-6">

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-teal-400"></div>
              <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Note Finale</h2>
              <div className="flex items-end justify-center gap-1 mb-4">
                <span className="text-6xl font-extrabold text-gray-900 tracking-tighter">{Math.round(totalScore * 10) / 10}</span>
                <span className="text-2xl font-medium text-gray-400 mb-2">/ {totalMax}</span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
                <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${barColor}`} style={{ width: `${pct}%` }}></div>
              </div>

              <div className="relative h-48 w-full flex justify-center">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 grid gap-3">
              <button onClick={handleCreate} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-3">
                <i className="fa-solid fa-save"></i> Enregistrer l'évaluation
              </button>
              <button onClick={handleDownloadPDF} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-3">
                <i className="fa-solid fa-file-pdf"></i> Enregistrer & Télécharger PDF
              </button>
              <button onClick={() => { if (window.confirm('Réinitialiser ?')) { setScores({}); setForm({ ...form, studentId: '', studentName: '', generalComment: '' }); setComments({}); } }} className="w-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3">
                <i className="fa-solid fa-rotate-right"></i> Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* PDF TEMPLATE */}
      <div ref={pdfTemplateRef} className="hidden">
        <div id="pdf-content" className="p-8 bg-white max-w-4xl mx-auto text-gray-800">
          <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedRubric?.title}</h1>
              <p className="text-sm uppercase tracking-wide text-gray-500 mt-1">{selectedRubric?.taskTitle}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Note Finale</div>
              <div className="text-4xl font-black text-blue-600">{Math.round(totalScore * 10) / 10}/{totalMax}</div>
            </div>
          </div>
          <div className="flex justify-between mb-8 bg-gray-50 p-4 rounded border border-gray-200">
            <div>
              <span className="block text-xs text-gray-400 uppercase">Étudiant</span>
              <strong className="text-lg">{form.studentName || 'Non spécifié'}</strong>
            </div>
            {showDatePdf && (
              <div className="text-right">
                <span className="block text-xs text-gray-400 uppercase">Date</span>
                <strong>{form.date}</strong>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {selectedRubric?.criteria?.map((c, i) => {
              const cid = c.id || c._id || String(i);
              const s = scores[cid] || 0;

              const pctC = s / (c.weight || 1);
              let descText = "Non évalué";
              if (s > 0 || scores[cid] === 0) {
                if (c.levels && c.levels.length > 0) {
                  const sortedLevels = [...c.levels].sort((a, b) => a.maxPct - b.maxPct);
                  let matchedLevel = sortedLevels[0];
                  for (const lvl of sortedLevels) {
                    if (pctC >= lvl.maxPct) matchedLevel = lvl;
                  }
                  descText = matchedLevel.desc || "Score attribué";
                } else {
                  descText = "Score attribué";
                }
              }

              return (
                <div key={cid} className="flex border-b border-gray-100 py-3 pdf-page-break">
                  <div className={`w-2 bg-blue-500 mr-3 rounded-full ${c.color?.replace('border-', 'bg-')}`}></div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-800 text-sm">{c.title}</h4>
                      <span className="font-mono font-bold text-gray-900">{s} <span className="text-gray-400 text-xs">/ {c.weight}</span></span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{descText}</p>
                    {c.subCriteria && c.subCriteria.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {c.subCriteria.map(sc => {
                          const isChecked = subScores[cid]?.[sc.id] || false;
                          return (
                            <div key={sc.id}>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`inline-block w-3.5 h-3.5 border rounded-sm flex-shrink-0 text-center leading-3 ${isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white'}`}>{isChecked ? '✓' : ''}</span>
                                <span className={isChecked ? 'text-gray-800 font-medium' : 'text-gray-400'}>{sc.label} ({sc.pts > 0 ? '+' : ''}{sc.pts} pts)</span>
                              </div>
                              {!isChecked && sc.feedback && <p className="text-xs text-red-500 ml-6 italic mt-0.5">⚠ {sc.feedback}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {comments[cid] && <div className="mt-1 text-xs text-gray-500 italic">Note: {comments[cid]}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {form.generalComment && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase mb-2">Synthèse de l'enseignant</h3>
              <div className="text-sm leading-relaxed text-gray-700 bg-gray-50 p-4 rounded text-justify whitespace-pre-wrap">{form.generalComment}</div>
            </div>
          )}

          {/* Rétroaction finale basée sur le pourcentage */}
          {selectedRubric?.feedbackMessages && selectedRubric.feedbackMessages.length > 0 && (() => {
            const finalPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            const match = selectedRubric.feedbackMessages.find(fm => finalPct >= fm.minPct && finalPct <= fm.maxPct);
            if (!match) return null;
            const msgColor = finalPct < 60 ? 'border-l-red-400 bg-red-50' : finalPct < 75 ? 'border-l-orange-400 bg-orange-50' : finalPct < 85 ? 'border-l-yellow-400 bg-yellow-50' : finalPct < 95 ? 'border-l-blue-400 bg-blue-50' : 'border-l-green-400 bg-green-50';
            const textColor = finalPct < 60 ? 'text-red-700' : finalPct < 75 ? 'text-orange-700' : finalPct < 85 ? 'text-yellow-700' : finalPct < 95 ? 'text-blue-700' : 'text-green-700';
            return (
              <div className={`mt-8 border-t border-gray-200 pt-6`}>
                <div className={`p-4 rounded-lg border-l-4 ${msgColor}`}>
                  <p className={`text-sm font-semibold ${textColor}`}>{match.message}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
