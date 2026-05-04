import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import PageSectionTitle from "../components/PageSectionTitle";
import HubContextBar from "../components/HubContextBar";
import MarkerBadge, { MarkerStyleControls } from "../components/MarkerBadge";
import { evalStudentId, evalRubricId, findLatestEvalForStudentRubric } from "../lib/evaluationHubHelpers";
import { studentDisplayName } from "../lib/studentDisplay";

function evalItemStudentId(it) {
  return evalStudentId(it);
}

function evalItemRubricId(it) {
  return evalRubricId(it);
}

function normalizeGroupLabel(groupValue) {
  const g = String(groupValue || "").trim();
  return g || "Sans groupe";
}

/** Liste déroulante étudiants avec icônes (le <select> natif ne permet pas le HTML dans les options). */
function StudentSelectWithIcons({
  students,
  valueStudentId,
  onSelectStudent,
  correctedIdsForExam,
  hasActiveRubric,
  groupStyleByLabel = {},
  wrapperClassName = "relative flex-1 min-w-0",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const groupedStudents = useMemo(() => {
    const acc = {};
    for (const s of students) {
      const g = normalizeGroupLabel(s.group);
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
    }
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b, "fr"))
      .map(([groupName, list]) => [
        groupName,
        [...list].sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b), "fr")),
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
        onSelectStudent({ studentId: student._id, studentName: studentDisplayName(student) });
      }
      setOpen(false);
    },
    [onSelectStudent]
  );

  return (
    <div className={`${wrapperClassName}${open ? " z-[300]" : ""}`} ref={wrapRef}>
      <button
        type="button"
        id="student-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="eval-form-control flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-slate-900 outline-none ring-blue-500/0 box-border focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected ? (
            <>
              {showStatus && (
                <span className="flex w-5 shrink-0 justify-center" aria-hidden>
                  {correctedIdsForExam.has(String(selected._id)) ? (
                    <i className="fa-solid fa-check text-green-600 text-sm dark:text-green-400" title="Corrigé pour cet examen" />
                  ) : (
                    <i className="fa-regular fa-circle text-amber-500 text-sm dark:text-amber-400" title="Pas encore corrigé pour cet examen" />
                  )}
                </span>
              )}
              <span className="truncate font-medium">{studentDisplayName(selected)}</span>
            </>
          ) : (
            <span className="text-slate-600 dark:text-slate-300">— Utilisateur libre —</span>
          )}
        </span>
        <i className={`fa-solid fa-chevron-down shrink-0 text-xs text-slate-500 transition-transform dark:text-slate-400 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul
          className="absolute left-0 right-0 top-full z-[320] mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-slate-500 dark:bg-slate-900 dark:ring-white/10"
          role="listbox"
          aria-labelledby="student-select-trigger"
        >
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!valueStudentId}
              className="w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => pick(null)}
            >
              — Utilisateur libre —
            </button>
          </li>
          {groupedStudents.map(([groupName, groupList]) => (
            <li key={groupName} role="none" className="pt-1">
              <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-bold italic tracking-wide text-slate-500 dark:text-slate-400">
                <MarkerBadge
                  color={groupStyleByLabel[groupName]?.color}
                  icon={groupStyleByLabel[groupName]?.icon}
                />
                <span>{groupName}</span>
              </div>
              <ul role="none">
                {groupList.map((s) => {
                  const sid = String(s._id);
                  const corrected = showStatus && correctedIdsForExam.has(sid);
                  const isSel = String(valueStudentId) === sid;
                  return (
                    <li key={s._id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        className={`mx-1 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                          isSel
                            ? "bg-blue-100 text-slate-900 dark:bg-indigo-900/85 dark:text-slate-50"
                            : "text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-800"
                        }`}
                        onClick={() => pick(s)}
                        title={showStatus ? (corrected ? "Corrigé pour cet examen" : "Pas encore corrigé") : undefined}
                      >
                        {showStatus ? (
                          <span className="flex w-5 shrink-0 justify-center" aria-hidden>
                            {corrected ? (
                              <i className="fa-solid fa-check text-sm text-green-600 dark:text-green-400" />
                            ) : (
                              <i className="fa-regular fa-circle text-sm text-amber-600 dark:text-amber-400" />
                            )}
                          </span>
                        ) : (
                          <span className="w-5 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 truncate">{studentDisplayName(s)}</span>
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
  const EVAL_DRAFT_STORAGE_KEY = "evaluations:last-unsaved-draft";
  const EVAL_LAST_RUBRIC_STORAGE_KEY = "evaluations:last-active-rubric-id";
  const EVAL_LAST_STUDENT_GROUP_STORAGE_KEY = "evaluations:last-student-picker-group";
  const HUB_LAST_GROUP_STORAGE_KEY = "evaluations:hub-last-group";
  const HUB_LAST_EXAM_STORAGE_KEY = "evaluations:hub-last-exam";
  const EMAIL_ACTIVE_JOB_STORAGE_KEY = "evaluations:active-email-job-id";
  const EMAIL_LAST_LOG_JOB_STORAGE_KEY = "evaluations:last-email-log-job-id";
  const EVAL_DATE_PREFS_STORAGE_KEY = "evaluations:date-prefs-by-group-rubric";
  const [searchParams, setSearchParams] = useSearchParams();
  const [rubrics, setRubrics] = useState([]);
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]); // Historique
  const [form, setForm] = useState({
    studentId: "",
    studentName: "",
    date: new Date().toISOString().slice(0, 10),
    generalComment: "",
    rubric: "",
    markerColor: "",
    markerIcon: "",
  });
  const [teamCorrectionMode, setTeamCorrectionMode] = useState(false);
  const [teamSelectedStudentIds, setTeamSelectedStudentIds] = useState([]);
  const [scores, setScores] = useState({});
  const [subScores, setSubScores] = useState({});
  /** Par case : n’affiche le feedback rouge d’un sous-critère que si cette case a été manipulée (évite le bruit visuel au début de la correction). */
  const [subCriteriaTouched, setSubCriteriaTouched] = useState({});
  const [comments, setComments] = useState({});
  const [showComment, setShowComment] = useState({});
  const [showDatePdf, setShowDatePdf] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const pdfTemplateRef = useRef(null);
  const lastCommittedEvalRef = useRef("");

  function stableNormalize(value) {
    if (Array.isArray(value)) return value.map(stableNormalize);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          out[k] = stableNormalize(value[k]);
        });
      return out;
    }
    return value;
  }

  function captureEvalSnapshot(next = {}) {
    const snap = {
      form: {
        _id: next.form?._id ?? form._id ?? "",
        studentId: next.form?.studentId ?? form.studentId ?? "",
        studentName: next.form?.studentName ?? form.studentName ?? "",
        rubric: next.form?.rubric ?? form.rubric ?? "",
        date: next.form?.date ?? form.date ?? "",
        generalComment: next.form?.generalComment ?? form.generalComment ?? "",
        markerColor: next.form?.markerColor ?? form.markerColor ?? "",
        markerIcon: next.form?.markerIcon ?? form.markerIcon ?? "",
      },
      scores: next.scores ?? scores,
      subScores: next.subScores ?? subScores,
      comments: next.comments ?? comments,
    };
    return JSON.stringify(stableNormalize(snap));
  }

  const hasEvaluationChanges = captureEvalSnapshot() !== lastCommittedEvalRef.current;

  /** Onglet principal : correction, suivi par examen, envois de copies. */
  const [evalPageTab, setEvalPageTab] = useState(() => {
    if (typeof window === "undefined") return "corriger";
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "suivi" || t === "envois" || t === "corriger") return t;
    return "corriger";
  });
  const [hubSelectedGroup, setHubSelectedGroup] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(HUB_LAST_GROUP_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [groupDashboard, setGroupDashboard] = useState([]);
  const [groupStyles, setGroupStyles] = useState([]);
  const [emailTargets, setEmailTargets] = useState({ groups: [], exams: [] });
  const [deliveries, setDeliveries] = useState([]);
  const [emailBatchConfig, setEmailBatchConfig] = useState({
    group: "",
    rubricId: (() => {
      if (typeof window === "undefined") return "";
      try {
        return localStorage.getItem(HUB_LAST_EXAM_STORAGE_KEY) || "";
      } catch {
        return "";
      }
    })(),
    skipAlreadySent: true,
    allowResendFailed: true,
    delayMs: 700,
  });
  const [hasManualSuiviExamSelection, setHasManualSuiviExamSelection] = useState(false);
  const [hubEvalSort, setHubEvalSort] = useState({ key: "name", dir: "asc" });
  const [correctionModalRow, setCorrectionModalRow] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailJob, setEmailJob] = useState(() => {
    if (typeof window === "undefined") return { jobId: "", status: "", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 };
    try {
      const persistedJobId = localStorage.getItem(EMAIL_ACTIVE_JOB_STORAGE_KEY) || "";
      return {
        jobId: persistedJobId,
        status: persistedJobId ? "queued" : "",
        processed: 0,
        total: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
    } catch {
      return { jobId: "", status: "", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 };
    }
  });
  const [logJobId, setLogJobId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return (
        localStorage.getItem(EMAIL_ACTIVE_JOB_STORAGE_KEY) ||
        localStorage.getItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY) ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [hubSendBusyId, setHubSendBusyId] = useState(null);

  function getDatePrefsMap() {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(EVAL_DATE_PREFS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setDatePrefsMap(nextMap) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(EVAL_DATE_PREFS_STORAGE_KEY, JSON.stringify(nextMap));
    } catch {
      // no-op
    }
  }

  function datePrefsKey(group, rubricId) {
    const g = String(group || "__all__");
    const r = String(rubricId || "__none__");
    return `${g}::${r}`;
  }

  function getPreferredDate(group, rubricId) {
    const key = datePrefsKey(group, rubricId);
    const map = getDatePrefsMap();
    return map[key]?.date || "";
  }

  function getPreferredShowDatePdf(group, rubricId) {
    const key = datePrefsKey(group, rubricId);
    const map = getDatePrefsMap();
    return Boolean(map[key]?.showDatePdf);
  }

  function persistLocalDraft() {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        form,
        scores,
        subScores,
        comments,
      };
      localStorage.setItem(EVAL_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Fallback silencieux : quota storage / mode privé.
    }
  }

  function clearLocalDraft() {
    try {
      localStorage.removeItem(EVAL_DRAFT_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  async function refresh() {
    try {
      const [evaluations, rubricList, studentList, dashboard, targets, sends, styleList] = await Promise.all([
        api.listEvaluations({ page: 1, limit: 2000 }),
        api.listRubrics(),
        api.listStudents(),
        api.getStudentGroupDashboard(),
        api.getEmailTargets(),
        api.listEmailDeliveries(),
        api.listGroupStyles(),
      ]);
      setItems(evaluations.items || []);
      setRubrics(rubricList);
      setStudents(studentList);
      setGroupDashboard(dashboard || []);
      setEmailTargets(targets || { groups: [], exams: [] });
      setDeliveries(sends || []);
      setGroupStyles(styleList || []);
      setHubSelectedGroup((prev) => prev || targets?.groups?.[0] || "");
      setEmailBatchConfig((prev) => {
        const examIds = new Set((targets?.exams || []).map((e) => String(e.rubricId)));
        const rubricId = prev.rubricId && examIds.has(String(prev.rubricId)) ? prev.rubricId : "";
        return {
          ...prev,
          group: prev.group || targets?.groups?.[0] || "",
          rubricId,
        };
      });
      const availableActiveRubrics = (rubricList || []).filter((r) => r?.isActive);
      if (!form.rubric && availableActiveRubrics[0]) {
        const rememberedHubRubricId = localStorage.getItem(HUB_LAST_EXAM_STORAGE_KEY);
        const rememberedRubricId = rememberedHubRubricId || localStorage.getItem(EVAL_LAST_RUBRIC_STORAGE_KEY);
        const rememberedExists = rememberedRubricId && availableActiveRubrics.some((r) => String(r._id) === String(rememberedRubricId));
        setForm((f) => ({ ...f, rubric: rememberedExists ? rememberedRubricId : availableActiveRubrics[0]._id }));
      }
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EVAL_DRAFT_STORAGE_KEY);
      if (!raw) return;
      if (form._id || Object.keys(scores).length || Object.keys(subScores).length || Object.keys(comments).length) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.form) return;
      const ok = window.confirm("Un brouillon local non enregistré a été trouvé. Voulez-vous le restaurer ?");
      if (!ok) return;
      setForm((f) => ({ ...f, ...(parsed.form || {}) }));
      setScores(parsed.scores || {});
      setSubScores(parsed.subScores || {});
      setComments(parsed.comments || {});
      setError("Brouillon local restauré.");
    } catch {
      // no-op
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.rubric) return;
    try {
      localStorage.setItem(EVAL_LAST_RUBRIC_STORAGE_KEY, String(form.rubric));
    } catch {
      // no-op
    }
  }, [form.rubric]);

  // Garde l'examen synchronisé entre Corriger <-> Suivi/Envois.
  useEffect(() => {
    const fr = String(form.rubric || "");
    const er = String(emailBatchConfig.rubricId || "");
    if (!fr || fr === er) return;
    setEmailBatchConfig((prev) => ({ ...prev, rubricId: fr }));
  }, [form.rubric, emailBatchConfig.rubricId]);

  useEffect(() => {
    try {
      if (hubSelectedGroup) {
        localStorage.setItem(HUB_LAST_GROUP_STORAGE_KEY, String(hubSelectedGroup));
      } else {
        localStorage.removeItem(HUB_LAST_GROUP_STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  }, [hubSelectedGroup]);

  const selectedRubric = rubrics.find((r) => r._id === form.rubric);
  const selectedTeamStudents = useMemo(() => {
    const set = new Set((teamSelectedStudentIds || []).map((id) => String(id)));
    return students.filter((s) => set.has(String(s._id)));
  }, [students, teamSelectedStudentIds]);
  const hasTeamTargets = selectedTeamStudents.length > 0;
  const canEditEvaluation = teamCorrectionMode ? hasTeamTargets : Boolean(form.studentId);

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

  const [studentPickerGroup, setStudentPickerGroup] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(EVAL_LAST_STUDENT_GROUP_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const studentGroupKeys = useMemo(() => {
    const set = new Set();
    for (const s of students) set.add(normalizeGroupLabel(s.group));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [students]);

  useEffect(() => {
    // Ne pas invalider le groupe mémorisé avant d'avoir chargé la liste réelle.
    if (studentGroupKeys.length === 0) return;
    if (!studentPickerGroup) return;
    if (studentGroupKeys.includes(studentPickerGroup)) return;
    setStudentPickerGroup("");
  }, [studentPickerGroup, studentGroupKeys]);

  useEffect(() => {
    try {
      if (studentPickerGroup) {
        localStorage.setItem(EVAL_LAST_STUDENT_GROUP_STORAGE_KEY, studentPickerGroup);
      } else {
        localStorage.removeItem(EVAL_LAST_STUDENT_GROUP_STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  }, [studentPickerGroup]);

  const activeRubricsForCorrection = useMemo(() => {
    const group = studentPickerGroup ? normalizeGroupLabel(studentPickerGroup) : "";
    return rubrics.filter((r) => {
      if (!r?.isActive) return false;
      const rubricGroups = Array.isArray(r?.groups)
        ? r.groups.map((g) => String(g || "").trim()).filter(Boolean)
        : [];
      const legacyGroup = String(r?.group || "").trim();
      const allGroups = Array.from(new Set([...rubricGroups, ...(legacyGroup ? [legacyGroup] : [])]));
      if (allGroups.length === 0) return true;
      if (!group) return true;
      return allGroups.includes(group);
    });
  }, [rubrics, studentPickerGroup]);

  const studentsForPicker = useMemo(() => {
    let list = !studentPickerGroup
      ? students
      : students.filter((s) => normalizeGroupLabel(s.group) === normalizeGroupLabel(studentPickerGroup));
    if (form.studentId) {
      const cur = students.find((s) => String(s._id) === String(form.studentId));
      if (cur && !list.some((s) => String(s._id) === String(cur._id))) {
        list = [...list, cur];
      }
    }
    return list;
  }, [students, studentPickerGroup, form.studentId]);

  useEffect(() => {
    if (!teamCorrectionMode) return;
    const allowed = new Set(studentsForPicker.map((s) => String(s._id)));
    setTeamSelectedStudentIds((prev) => prev.filter((id) => allowed.has(String(id))));
  }, [teamCorrectionMode, studentsForPicker]);

  function onStudentPickerGroupChange(g) {
    setStudentPickerGroup(g);
    setForm((f) => {
      if (!f.studentId) return f;
      const st = students.find((s) => String(s._id) === String(f.studentId));
      if (!st) return { ...f, studentId: "", studentName: "" };
      const grp = normalizeGroupLabel(st.group);
      if (g && grp !== normalizeGroupLabel(g)) return { ...f, studentId: "", studentName: "" };
      return f;
    });
  }

  function toggleTeamCorrectionMode(enabled) {
    setTeamCorrectionMode(enabled);
    if (enabled) {
      const current = form.studentId ? [String(form.studentId)] : [];
      setTeamSelectedStudentIds((prev) => {
        const merged = Array.from(new Set([...prev.map(String), ...current]));
        return merged;
      });
      // En mode équipe, on reste sur un brouillon commun pour éviter d'écraser une copie individuelle ouverte.
      setForm((f) => ({ ...f, _id: undefined, studentId: "", studentName: "" }));
      return;
    }
    const fallback = selectedTeamStudents[0];
    setTeamSelectedStudentIds([]);
    if (fallback) {
      void syncEvaluationForStudentAndRubric(String(fallback._id), studentDisplayName(fallback), form.rubric);
    }
  }

  function toggleTeamStudent(studentId, checked) {
    const sid = String(studentId);
    setTeamSelectedStudentIds((prev) => {
      if (checked) return prev.includes(sid) ? prev : [...prev, sid];
      return prev.filter((id) => String(id) !== sid);
    });
  }

  useEffect(() => {
    if (evalPageTab !== "corriger") return;
    if ((studentPickerGroup || "") === (hubSelectedGroup || "")) return;
    onStudentPickerGroupChange(hubSelectedGroup || "");
  }, [evalPageTab, hubSelectedGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const hubGroupedStudents = useMemo(() => {
    const acc = {};
    for (const s of students) {
      const g = normalizeGroupLabel(s.group);
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
    }
    return acc;
  }, [students]);
  const hubGroupKeys = Object.keys(hubGroupedStudents).sort();

  const groupStyleByLabel = useMemo(() => {
    const m = {};
    for (const s of groupStyles || []) {
      if (s?.groupKey) m[s.groupKey] = { color: s.color || "", icon: s.icon || "" };
    }
    return m;
  }, [groupStyles]);

  const hubFilteredStudents = hubSelectedGroup ? hubGroupedStudents[hubSelectedGroup] || [] : students;

  const examsForSend = useMemo(() => {
    const exams = emailTargets.exams || [];
    const rubricIdsWithCorrection = new Set();
    items.forEach((it) => {
      const sid = evalStudentId(it);
      if (!sid) return;
      const student = students.find((x) => String(x._id) === sid);
      if (!student) return;
      const g = normalizeGroupLabel(student.group);
      if (hubSelectedGroup && g !== hubSelectedGroup) return;
      const rid = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
      if (rid) rubricIdsWithCorrection.add(rid);
    });
    return exams.filter((ex) => rubricIdsWithCorrection.has(String(ex.rubricId)));
  }, [hubSelectedGroup, students, items, emailTargets.exams]);

  useEffect(() => {
    setEmailBatchConfig((prev) => {
      if (!prev.rubricId) return prev;
      const ok = examsForSend.some((e) => String(e.rubricId) === String(prev.rubricId));
      if (ok) return prev;
      setHasManualSuiviExamSelection(false);
      return { ...prev, rubricId: "" };
    });
  }, [examsForSend]);

  const selectedSendExam = useMemo(
    () => examsForSend.find((x) => String(x.rubricId) === String(emailBatchConfig.rubricId)),
    [examsForSend, emailBatchConfig.rubricId]
  );

  const selectedHubExamId = evalPageTab === "corriger" ? form.rubric : emailBatchConfig.rubricId;

  useEffect(() => {
    try {
      if (selectedHubExamId) {
        localStorage.setItem(HUB_LAST_EXAM_STORAGE_KEY, String(selectedHubExamId));
      } else {
        localStorage.removeItem(HUB_LAST_EXAM_STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  }, [selectedHubExamId]);

  useEffect(() => {
    if (!form.rubric) return;
    const preferred = getPreferredDate(hubSelectedGroup, form.rubric);
    const preferredShowPdf = getPreferredShowDatePdf(hubSelectedGroup, form.rubric);
    setShowDatePdf(preferredShowPdf);
    if (!preferred) return;
    // Applique la date préférée pour les nouveaux brouillons (pas une copie existante chargée).
    if (form._id) return;
    setForm((prev) => ({ ...prev, date: preferred }));
  }, [hubSelectedGroup, form.rubric]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.rubric) return;
    const key = datePrefsKey(hubSelectedGroup, form.rubric);
    const map = getDatePrefsMap();
    map[key] = { date: form.date, showDatePdf: Boolean(showDatePdf), updatedAt: new Date().toISOString() };
    setDatePrefsMap(map);
  }, [hubSelectedGroup, form.rubric, form.date, showDatePdf]);
  const hubExamOptions = useMemo(() => {
    if (evalPageTab === "corriger") {
      return activeRubricsForCorrection.map((r) => ({
        rubricId: String(r._id),
        title: r.title,
        taskTitle: r.taskTitle,
        version: r.version,
      }));
    }
    return examsForSend;
  }, [evalPageTab, activeRubricsForCorrection, examsForSend]);
  const hubExamGroupMarkers = useMemo(() => {
    const byRubric = {};
    const studentGroupById = new Map(students.map((s) => [String(s._id), normalizeGroupLabel(s.group)]));
    for (const it of items) {
      const rid = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : "";
      if (!rid) continue;
      const sid = evalStudentId(it);
      const gl = sid ? studentGroupById.get(String(sid)) || "Sans groupe" : "Sans groupe";
      const gs = groupStyleByLabel[gl];
      if (!gs || (!gs.color && !gs.icon)) continue;
      if (!byRubric[rid]) byRubric[rid] = [];
      const k = `${gs.color || ""}::${gs.icon || ""}`;
      if (!byRubric[rid].some((x) => `${x.color || ""}::${x.icon || ""}` === k)) {
        byRubric[rid].push({ color: gs.color || "", icon: gs.icon || "", groupLabel: gl });
      }
    }
    return byRubric;
  }, [items, students, groupStyleByLabel]);

  const hubBarStats = useMemo(() => {
    const totalStudents = hubFilteredStudents.length;
    const selectedRubricId = String(selectedHubExamId || "");
    if (!selectedRubricId) {
      return {
        students: totalStudents,
        correctedLabel: "-",
        avgPct: null,
        sentFailed: "-",
      };
    }

    const scopeStudentIds = new Set(hubFilteredStudents.map((s) => String(s._id)));
    const latestEvalByStudent = new Map();
    const correctedIds = new Set();
    for (const it of items) {
      const sid = evalStudentId(it);
      if (!sid || !scopeStudentIds.has(sid)) continue;
      const rid = it.rubric?._id != null ? String(it.rubric._id) : it.rubric != null ? String(it.rubric) : null;
      if (rid !== selectedRubricId) continue;
      correctedIds.add(sid);
      const prev = latestEvalByStudent.get(sid);
      const prevTs = prev ? new Date(prev.updatedAt || prev.createdAt || 0).getTime() : -1;
      const nextTs = new Date(it.updatedAt || it.createdAt || 0).getTime();
      if (!prev || nextTs >= prevTs) latestEvalByStudent.set(sid, it);
    }

    let avgPct = null;
    if (latestEvalByStudent.size > 0) {
      let sum = 0;
      let count = 0;
      latestEvalByStudent.forEach((ev) => {
        const totalMax = Number(ev.totalMax || 0);
        if (totalMax <= 0) return;
        const pct = (Number(ev.totalScore || 0) / totalMax) * 100;
        sum += pct;
        count += 1;
      });
      if (count > 0) avgPct = Number((sum / count).toFixed(1));
    }

    const studentGroupById = new Map(students.map((s) => [String(s._id), s.group || "Sans groupe"]));
    let sent = 0;
    let failed = 0;
    for (const d of deliveries) {
      const deliveryStudentId = String(d.studentId?._id ?? d.studentId ?? "");
      if (deliveryStudentId && !scopeStudentIds.has(deliveryStudentId)) continue;
      const deliveryGroup =
        d.group || d.studentId?.group || studentGroupById.get(deliveryStudentId) || "Sans groupe";
      if (hubSelectedGroup && deliveryGroup !== hubSelectedGroup) continue;

      const examKeyStr = String(d.examKey || "");
      const deliveryRubricId = String(d.evaluationId?.rubric?._id ?? d.evaluationId?.rubric ?? "");
      const sameExam = examKeyStr.startsWith(`${selectedRubricId}:`) || deliveryRubricId === selectedRubricId;
      if (!sameExam) continue;

      if (d.status === "sent") sent += 1;
      if (d.status === "failed") failed += 1;
    }

    return {
      students: totalStudents,
      correctedLabel: `${correctedIds.size}/${totalStudents}`,
      avgPct,
      sentFailed: `${sent}/${failed}`,
    };
  }, [hubFilteredStudents, selectedHubExamId, items, students, deliveries, hubSelectedGroup]);

  /**
   * Onglet "Suivi": par défaut, reprend l'examen actif dans "Corriger"
   * si cet examen est disponible dans la liste de suivi.
   */
  useEffect(() => {
    if (evalPageTab !== "suivi") return;
    if (emailBatchConfig.rubricId) return;
    if (hasManualSuiviExamSelection) return;
    if (!form.rubric) return;
    const existsInSuivi = examsForSend.some((e) => String(e.rubricId) === String(form.rubric));
    if (!existsInSuivi) return;
    setEmailBatchConfig((prev) => ({ ...prev, rubricId: String(form.rubric) }));
  }, [evalPageTab, emailBatchConfig.rubricId, hasManualSuiviExamSelection, form.rubric, examsForSend]);

  const hubEvalTableRows = useMemo(() => {
    const rid = emailBatchConfig.rubricId;
    if (!rid) return [];
    const byEvalId = new Map();
    for (const d of deliveries || []) {
      const eid = String(d.evaluationId?._id ?? d.evaluationId ?? "");
      if (!eid) continue;
      const prev = byEvalId.get(eid);
      const nextTs = new Date(d.updatedAt || d.createdAt || 0).getTime();
      const prevTs = prev ? new Date(prev.updatedAt || prev.createdAt || 0).getTime() : -1;
      if (!prev || nextTs >= prevTs) byEvalId.set(eid, d);
    }
    return hubFilteredStudents.map((s) => {
      const ev = findLatestEvalForStudentRubric(s._id, rid, items);
      const tm = ev?.totalMax ?? 0;
      const ts = ev?.totalScore ?? 0;
      const pctRow = tm > 0 ? (Number(ts) / Number(tm)) * 100 : null;
      const dateStr = ev?.date ? String(ev.date).slice(0, 10) : "";
      const evIdStr = ev?._id != null ? String(ev._id) : "";
      const delivery = evIdStr ? byEvalId.get(evIdStr) ?? null : null;
      return {
        student: s,
        evaluation: ev,
        corrected: !!ev,
        pct: pctRow,
        dateStr,
        delivery,
      };
    });
  }, [hubFilteredStudents, items, emailBatchConfig.rubricId, deliveries]);

  const hubEvalSortedRows = useMemo(() => {
    const rows = [...hubEvalTableRows];
    const { key, dir } = hubEvalSort;
    const mult = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "name":
          cmp = studentDisplayName(a.student).localeCompare(studentDisplayName(b.student), "fr");
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
        case "email": {
          const rank = (r) => {
            if (!r.corrected) return 0;
            const mail = (r.student.email || "").trim();
            if (!mail) return 1;
            const st = r.delivery?.status;
            if (!st) return 2;
            if (st === "failed") return 3;
            if (st === "queued") return 4;
            if (st === "skipped") return 5;
            if (st === "sent") return 6;
            return 2;
          };
          cmp = rank(a) - rank(b);
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

  async function sendEvalEmailFromHub(evaluationId) {
    setError("");
    const id = String(evaluationId);
    setHubSendBusyId(id);
    try {
      let res = await api.sendEvaluationEmailOne(id);
      if (res?.alreadySent) {
        const ok = window.confirm(
          "Cette copie a déjà été envoyée par courriel. Voulez-vous la renvoyer ?"
        );
        if (ok) res = await api.sendEvaluationEmailOne(id, { resend: true });
      }
      const oneSendJobId = String(res?.delivery?.jobId || "");
      if (oneSendJobId) {
        setLogJobId(oneSendJobId);
        try {
          localStorage.setItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY, oneSendJobId);
        } catch {
          // no-op
        }
      }
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setHubSendBusyId(null);
    }
  }

  const enrollSendSummaries = useMemo(() => {
    if (!hubSelectedGroup) return [];
    const groupStudents = students.filter((s) => (s.group || "Sans groupe") === hubSelectedGroup);
    if (!groupStudents.length) return [];
    const groupStudentIds = new Set(groupStudents.map((s) => String(s._id)));
    const studentGroupById = new Map(students.map((s) => [String(s._id), s.group || "Sans groupe"]));
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

      const sentCopies = deliveries.filter((d) => {
        if (d.status !== "sent") return false;
        const deliveryStudentId = String(d.studentId?._id ?? d.studentId ?? "");
        const deliveryGroup =
          d.group ||
          d.studentId?.group ||
          studentGroupById.get(deliveryStudentId) ||
          "Sans groupe";
        if (deliveryGroup !== hubSelectedGroup) return false;

        // Match examen par rubricId (ignore la version), pour inclure envois manuels
        // même si la version de la grille a évolué après l'envoi.
        const examKeyStr = String(d.examKey || "");
        if (examKeyStr.startsWith(`${rubricId}:`)) return true;
        const deliveryRubricId = String(d.evaluationId?.rubric?._id ?? d.evaluationId?.rubric ?? "");
        return deliveryRubricId === rubricId;
      }).length;

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
  }, [hubSelectedGroup, students, items, examsForSend, deliveries]);

  const selectedEnrollSendSummary = useMemo(
    () => enrollSendSummaries.find((row) => String(row.rubricId) === String(emailBatchConfig.rubricId)) || null,
    [enrollSendSummaries, emailBatchConfig.rubricId]
  );

  const correctionModalLists = useMemo(() => {
    if (!correctionModalRow || !hubSelectedGroup) return { corrected: [], pending: [], title: "" };
    const rubricId = String(correctionModalRow.rubricId);
    const groupStudents = students.filter((s) => (s.group || "Sans groupe") === hubSelectedGroup);
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
    const cmp = (a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b), "fr");
    corrected.sort(cmp);
    pending.sort(cmp);
    return {
      corrected,
      pending,
      title: correctionModalRow.title || "Examen",
    };
  }, [correctionModalRow, hubSelectedGroup, students, items]);

  const visibleDeliveries = useMemo(() => {
    if (!hubSelectedGroup) return deliveries;
    const studentGroupById = new Map(students.map((s) => [String(s._id), s.group || "Sans groupe"]));
    return deliveries.filter((d) => {
      const deliveryStudentId = String(d.studentId?._id ?? d.studentId ?? "");
      const deliveryGroup =
        d.group ||
        d.studentId?.group ||
        studentGroupById.get(deliveryStudentId) ||
        "Sans groupe";
      return deliveryGroup === hubSelectedGroup;
    });
  }, [hubSelectedGroup, deliveries, students]);

  const visibleDeliveriesForExam = useMemo(() => {
    if (!emailBatchConfig.rubricId) return visibleDeliveries;
    const prefix = `${emailBatchConfig.rubricId}:`;
    return visibleDeliveries.filter((d) => String(d.examKey || "").startsWith(prefix));
  }, [visibleDeliveries, emailBatchConfig.rubricId]);

  const emailJobLogs = useMemo(() => {
    const effectiveJobId =
      logJobId ||
      visibleDeliveriesForExam.find((d) => d.jobId)?.jobId ||
      visibleDeliveries.find((d) => d.jobId)?.jobId ||
      "";
    if (!effectiveJobId) return [];
    // Ne pas filtrer par examen ici : le jobId peut provenir d’un envoi alors qu’un autre
    // examen est sélectionné dans le hub, ou l’examKey peut différer légèrement (version).
    return visibleDeliveries
      .filter((d) => String(d.jobId || "") === String(effectiveJobId))
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [visibleDeliveries, visibleDeliveriesForExam, logJobId]);

  const effectiveLogJobId = useMemo(
    () =>
      logJobId ||
      visibleDeliveriesForExam.find((d) => d.jobId)?.jobId ||
      visibleDeliveries.find((d) => d.jobId)?.jobId ||
      "",
    [logJobId, visibleDeliveriesForExam, visibleDeliveries]
  );

  useEffect(() => {
    if (!effectiveLogJobId || logJobId === effectiveLogJobId) return;
    setLogJobId(String(effectiveLogJobId));
    try {
      localStorage.setItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY, String(effectiveLogJobId));
    } catch {
      // no-op
    }
  }, [effectiveLogJobId, logJobId]);

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
        rubric: typeof data.rubric === 'object' ? data.rubric._id : data.rubric,
        markerColor: data.markerColor || "",
        markerIcon: data.markerIcon || "",
      });
      setScores(data.scores || {});
      setSubScores(data.subScores || {});
      const restoredSubTouched = {};
      if (data.subScores && typeof data.subScores === "object") {
        Object.entries(data.subScores).forEach(([critKey, map]) => {
          if (!map || typeof map !== "object") return;
          restoredSubTouched[critKey] = {};
          Object.keys(map).forEach((scId) => {
            restoredSubTouched[critKey][scId] = true;
          });
        });
      }
      setSubCriteriaTouched(restoredSubTouched);
      setComments(data.comments || {});
      lastCommittedEvalRef.current = captureEvalSnapshot({
        form: {
          _id: data._id,
          studentId: data.studentId || "",
          studentName: data.studentName || "",
          date: data.date.slice(0, 10),
          generalComment: data.generalComment || "",
          rubric: typeof data.rubric === "object" ? data.rubric._id : data.rubric,
          markerColor: data.markerColor || "",
          markerIcon: data.markerIcon || "",
        },
        scores: data.scores || {},
        subScores: data.subScores || {},
        comments: data.comments || {},
      });
      window.scrollTo(0, 0);
    } catch (e) {
      setError("Impossible de charger l'évaluation.");
    }
  }

  function clearDraftEvaluation(overrides = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const nextRubric = Object.prototype.hasOwnProperty.call(overrides, "rubric") ? overrides.rubric : form.rubric;
    const preferred = nextRubric ? getPreferredDate(hubSelectedGroup, nextRubric) : "";
    const nextDate = Object.prototype.hasOwnProperty.call(overrides, "date")
      ? overrides.date
      : preferred || today;
    setForm((f) => ({
      ...f,
      ...overrides,
      _id: undefined,
      date: nextDate,
      generalComment: Object.prototype.hasOwnProperty.call(overrides, "generalComment") ? overrides.generalComment : "",
      markerColor: Object.prototype.hasOwnProperty.call(overrides, "markerColor") ? overrides.markerColor : "",
      markerIcon: Object.prototype.hasOwnProperty.call(overrides, "markerIcon") ? overrides.markerIcon : "",
    }));
    setScores({});
    setSubScores({});
    setSubCriteriaTouched({});
    setComments({});
    const nextForm = {
      ...form,
      ...overrides,
      _id: undefined,
      date: nextDate,
      generalComment: Object.prototype.hasOwnProperty.call(overrides, "generalComment") ? overrides.generalComment : "",
      markerColor: Object.prototype.hasOwnProperty.call(overrides, "markerColor") ? overrides.markerColor : "",
      markerIcon: Object.prototype.hasOwnProperty.call(overrides, "markerIcon") ? overrides.markerIcon : "",
    };
    lastCommittedEvalRef.current = captureEvalSnapshot({
      form: nextForm,
      scores: {},
      subScores: {},
      comments: {},
    });
  }

  /** Charge la dernière copie pour l’étudiant + l’examen, ou prépare une nouvelle saisie. */
  async function syncEvaluationForStudentAndRubric(studentId, studentName, rubricId) {
    setError("");
    if (!rubricId) {
      if (!studentId) {
        clearDraftEvaluation({ studentId: "", studentName: "", rubric: "" });
      } else {
        setForm((f) => ({ ...f, studentId, studentName: studentName || "" }));
      }
      return;
    }
    if (!studentId) {
      clearDraftEvaluation({ studentId: "", studentName: "", rubric: rubricId });
      return;
    }
    const latest = findLatestEvalForStudentRubric(studentId, rubricId, items);
    if (latest) {
      if (String(form._id) === String(latest._id)) return;
      await loadEvaluation(latest._id);
      return;
    }
    clearDraftEvaluation({
      studentId,
      studentName: studentName || "",
      rubric: rubricId,
    });
  }

  async function deleteEval(id) {
    if (!window.confirm('Supprimer cette évaluation ?')) return;
    try {
      await api.deleteEvaluation(id);
      if (form._id === id) {
        setForm({
          studentId: "",
          studentName: "",
          date: new Date().toISOString().slice(0, 10),
          generalComment: "",
          rubric: rubrics[0]?._id,
          markerColor: "",
          markerIcon: "",
        });
        setScores({});
        setSubScores({});
        setSubCriteriaTouched({});
        setComments({});
      }
      refresh();
    } catch (e) {
      setError("Erreur lors de la suppression");
    }
  }

  const [autoDownload, setAutoDownload] = useState(false);

  function setEvalTab(tab) {
    setEvalPageTab(tab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    }, { replace: true });
  }

  useEffect(() => {
    const loadId = searchParams.get("load");
    const dl = searchParams.get("download");
    const tabParam = searchParams.get("tab");
    if (tabParam === "suivi" || tabParam === "envois" || tabParam === "corriger") {
      setEvalPageTab(tabParam);
    }
    if (loadId) {
      setEvalPageTab("corriger");
      loadEvaluation(loadId);
      if (dl === "true") setAutoDownload(true);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("load");
        p.delete("download");
        p.set("tab", "corriger");
        return p;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function openEmailSendModal() {
    setError("");
    if (!emailBatchConfig.rubricId) {
      setError("Sélectionnez d'abord un examen pour l'envoi.");
      return;
    }
    setEmailBatchConfig((prev) => ({
      ...prev,
      group: hubSelectedGroup || prev.group,
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
      setLogJobId(jobId);
      try {
        localStorage.setItem(EMAIL_ACTIVE_JOB_STORAGE_KEY, jobId);
        localStorage.setItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY, jobId);
      } catch {
        // no-op
      }
      setShowEmailModal(false);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function retryFailed(jobId) {
    try {
      const res = await api.retryFailedEmailBatch(jobId, { delayMs: Number(emailBatchConfig.delayMs || 700) });
      if (res?.jobId) {
        setEmailJob({ jobId: res.jobId, status: "queued", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 });
        setLogJobId(res.jobId);
        try {
          localStorage.setItem(EMAIL_ACTIVE_JOB_STORAGE_KEY, res.jobId);
          localStorage.setItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY, res.jobId);
        } catch {
          // no-op
        }
      }
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function clearEmailLogs() {
    setEmailJob({ jobId: "", status: "", processed: 0, total: 0, sent: 0, failed: 0, skipped: 0 });
    setLogJobId("");
    try {
      localStorage.removeItem(EMAIL_ACTIVE_JOB_STORAGE_KEY);
      localStorage.removeItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (!emailJob.jobId) return undefined;
    const timer = setInterval(async () => {
      try {
        const progress = await api.getEmailBatchProgress(emailJob.jobId);
        setEmailJob((prev) => ({ ...prev, ...progress, jobId: emailJob.jobId }));
        setLogJobId(emailJob.jobId);
        const sends = await api.listEmailDeliveries();
        setDeliveries(sends || []);
        if (progress.status === "completed" || progress.status === "failed") {
          try {
            localStorage.removeItem(EMAIL_ACTIVE_JOB_STORAGE_KEY);
            localStorage.setItem(EMAIL_LAST_LOG_JOB_STORAGE_KEY, emailJob.jobId);
          } catch {
            // no-op
          }
          clearInterval(timer);
        }
      } catch {
        try {
          localStorage.removeItem(EMAIL_ACTIVE_JOB_STORAGE_KEY);
        } catch {
          // no-op
        }
        clearInterval(timer);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [emailJob.jobId]);

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
    if (teamCorrectionMode) {
      if (!form.rubric) {
        setError("Sélectionnez un examen avant d'enregistrer une correction en équipe.");
        return false;
      }
      if (!selectedTeamStudents.length) {
        setError("Sélectionnez au moins un étudiant pour la correction en équipe.");
        return false;
      }
      try {
        for (const st of selectedTeamStudents) {
          const sid = String(st._id);
          const sname = studentDisplayName(st);
          const latest = findLatestEvalForStudentRubric(sid, form.rubric, items);
          const payload = {
            ...form,
            _id: undefined,
            studentId: sid,
            studentName: sname,
            scores,
            subScores,
            comments,
          };
          if (latest?._id) {
            await api.updateEvaluation(latest._id, payload);
          } else {
            await api.createEvaluation(payload);
          }
        }
        clearLocalDraft();
        lastCommittedEvalRef.current = captureEvalSnapshot({
          form: { ...form, _id: undefined },
        });
        await refresh();
        return true;
      } catch (err) {
        persistLocalDraft();
        setError(String(err.message || err));
        return false;
      }
    }
    if (!form.studentId) {
      setError("Sélectionnez un étudiant avant de modifier ou enregistrer une évaluation.");
      return false;
    }
    try {
      if (form._id) {
        await api.updateEvaluation(form._id, { ...form, scores, subScores, comments });
        lastCommittedEvalRef.current = captureEvalSnapshot();
      } else {
        const res = await api.createEvaluation({ ...form, scores, subScores, comments });
        setForm(f => ({ ...f, _id: res._id }));
        lastCommittedEvalRef.current = captureEvalSnapshot({
          form: { ...form, _id: res._id },
        });
      }
      clearLocalDraft();
      await refresh();
      return true;
    } catch (err) {
      persistLocalDraft();
      const raw = String(err.message || err);
      const isNetwork = /connexion au serveur impossible|networkerror|failed to fetch/i.test(raw);
      if (isNetwork) {
        setError("Impossible d'enregistrer pour le moment (connexion serveur). Votre brouillon local est conservé : ne fermez pas la page, puis réessayez.");
      } else {
        setError(raw);
      }
      return false;
    }
  }

  async function handleCreate(e) {
    if (e) e.preventDefault();
    if (await saveEval()) {
      if (teamCorrectionMode) {
        alert(`${selectedTeamStudents.length} évaluation(s) enregistrée(s) individuellement.`);
      } else {
        alert("Évaluation enregistrée avec succès !");
      }
    }
  }

  async function handleDownloadPDF() {
    setError("");
    if (teamCorrectionMode) {
      setError("Le PDF individuel n'est pas disponible en mode correction en équipe.");
      return;
    }
    if (!form.studentName) { setError("Veuillez sélectionner un étudiant."); return; }
    const success = await saveEval();
    if (success) {
      generatePDF();
    }
  }

  function handleScore(id, val) {
    setScores(s => ({ ...s, [id]: parseFloat(val) }));
  }

  function handleLevelClick(cid, criterion, lvl) {
    const val = criterion.weight * lvl.maxPct;
    setScores(s => ({ ...s, [cid]: parseFloat(val) }));

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
    setSubCriteriaTouched((t) => ({
      ...t,
      [cid]: { ...(t[cid] || {}), [scId]: true },
    }));

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
    if (!content) return;

    const baseRubricTitle = (selectedRubric?.taskTitle || selectedRubric?.title || 'Evaluation').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_');
    const baseStudentName = (form.studentName || 'Etudiant').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_');

    // Rendu PDF hors-écran, ancré en haut pour éviter les pages blanches liées au scroll.
    const previousStyle = template.getAttribute("style") || "";
    template.classList.remove("hidden");
    template.style.position = "fixed";
    template.style.left = "-10000px";
    template.style.top = "0";
    template.style.width = "1200px";
    template.style.zIndex = "-1";
    template.style.pointerEvents = "none";
    template.style.background = "#ffffff";
    void template.offsetWidth; // force reflow

    const opt = {
      margin: 0.5,
      filename: `${baseRubricTitle}-${baseStudentName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css'], avoid: ['h3'] }
    };

    window
      .html2pdf()
      .set(opt)
      .from(content)
      .save()
      .finally(() => {
        if (previousStyle) {
          template.setAttribute("style", previousStyle);
        } else {
          template.removeAttribute("style");
        }
        template.classList.add("hidden");
      });
  }

  const pageSubtitle = useMemo(() => {
    if (evalPageTab === "suivi") return "Suivi d'évaluation par examen";
    if (evalPageTab === "envois") return "Envois de copies par courriel";
    return "Plateforme d'évaluation";
  }, [evalPageTab]);

  return (
    <>
      <main className="flex w-full flex-1 flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4 space-y-6">
        <PageSectionTitle
          icon="fa-graduation-cap"
          iconBgClass="bg-blue-600"
          title="ÉvaluPro"
          subtitle={pageSubtitle}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200">{error}</div>
        )}

        {(evalPageTab === "suivi" || evalPageTab === "envois" || evalPageTab === "corriger") && (
          <HubContextBar
            selectedGroup={hubSelectedGroup}
            setSelectedGroup={(nextGroup) => {
              setHubSelectedGroup(nextGroup);
              onStudentPickerGroupChange(nextGroup);
            }}
            groupKeys={hubGroupKeys}
            activeGroupStyle={hubSelectedGroup ? groupStyleByLabel[hubSelectedGroup] : null}
            selectedExamId={selectedHubExamId}
            setSelectedExamId={(rubricId) => {
              const nextRubricId = String(rubricId || "");
              setEmailBatchConfig((prev) => ({ ...prev, rubricId: nextRubricId }));
              setForm((prev) => ({ ...prev, rubric: nextRubricId }));
              if (evalPageTab === "corriger") {
                if (nextRubricId) localStorage.setItem(EVAL_LAST_RUBRIC_STORAGE_KEY, nextRubricId);
                void syncEvaluationForStudentAndRubric(form.studentId, form.studentName, nextRubricId);
                return;
              }
              setHasManualSuiviExamSelection(true);
            }}
            examOptions={hubExamOptions}
            examGroupMarkers={hubExamGroupMarkers}
            stats={hubBarStats}
          />
        )}

        {evalPageTab === "corriger" && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Evaluation Form */}
        <div className="lg:col-span-8 space-y-6">
          {!canEditEvaluation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200">
              Sélectionnez un étudiant pour commencer la correction. Les champs d&apos;évaluation restent verrouillés tant qu&apos;aucun étudiant n&apos;est choisi.
            </div>
          )}

          <div className={`space-y-4 ${!canEditEvaluation ? "opacity-60 pointer-events-none select-none" : ""}`}>
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
                        <button disabled={!canEditEvaluation} onClick={() => setShowComment(s => ({ ...s, [cid]: !s[cid] }))} className="ml-2 text-gray-400 hover:text-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed"><i className="fa-regular fa-comment-dots text-xl"></i></button>
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
                                <button key={lnum} disabled={!canEditEvaluation} onClick={() => handleLevelClick(cid, c, lvl)} className={`w-full py-2 px-1 text-xs font-semibold rounded border transition ${btnClass} leading-tight disabled:opacity-50 disabled:cursor-not-allowed`}>
                                  {lvl.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="relative pt-4 pb-2">
                          <input disabled={!canEditEvaluation} type="range" min="0" max={c.weight || 10} step="0.5" value={currentScore} className="w-full h-2 accent-blue-600 cursor-pointer disabled:cursor-not-allowed" onChange={e => handleScore(cid, e.target.value)} />
                        </div>

                        {c.subCriteria && c.subCriteria.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                            {c.subCriteria.map(sc => {
                              const isChecked = subScores[cid]?.[sc.id] || false;
                              return (
                                <label key={sc.id} className={`flex items-start gap-3 p-2 rounded cursor-pointer transition border ${isChecked ? 'border-purple-200 bg-purple-50/50 dark:border-violet-500/40 dark:bg-violet-950/40' : 'border-transparent hover:border-gray-100 hover:bg-gray-50 dark:hover:border-white/10 dark:hover:bg-white/[0.04]'}`}>
                                  <input disabled={!canEditEvaluation} type="checkbox" checked={isChecked} onChange={e => handleSubScore(cid, sc.id, e.target.checked, c)} className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 flex-shrink-0 dark:border-slate-500 dark:bg-slate-800 disabled:cursor-not-allowed" />
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className={`text-sm ${isChecked ? "text-purple-700 font-semibold dark:text-violet-200" : "text-gray-900 dark:text-slate-200"}`}>{sc.label}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300">Valeur : {sc.pts > 0 ? '+' : ''}{sc.pts} pts</span>
                                    {!isChecked && sc.feedback && subCriteriaTouched[cid]?.[sc.id] && (
                                      <p className="text-xs text-red-700 dark:text-red-200 mt-1 italic rounded-md border border-red-200/80 bg-red-50/90 px-2 py-1.5 dark:border-red-500/35 dark:bg-red-950/55 leading-snug">
                                        ⚠ {sc.feedback}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}

                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[80px] flex flex-col justify-center dark:border-white/10">
                        <p className="text-sm text-gray-700 dark:text-slate-200 italic leading-snug">{descText}</p>
                        {c.subCriteria && c.subCriteria.length > 0 && (() => {
                          const missingFeedbacks = c.subCriteria
                            .filter(
                              (sc) =>
                                !subScores[cid]?.[sc.id] && sc.feedback && subCriteriaTouched[cid]?.[sc.id]
                            )
                            .map((sc) => sc.feedback);
                          return missingFeedbacks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10 space-y-1.5">
                              {missingFeedbacks.map((fb, fbI) => (
                                <p key={fbI} className="text-xs text-red-700 dark:text-red-200 rounded-md border border-red-200/70 bg-red-50/90 px-2 py-1 dark:border-red-500/35 dark:bg-red-950/50 leading-snug">
                                  ✗ {fb}
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {showComment[cid] && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase">Commentaire spécifique</label>
                        <textarea disabled={!canEditEvaluation} className="w-full mt-1 p-2 border border-gray-300 rounded text-sm outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" rows="2" value={comments[cid] || ""} onChange={e => setComments(s => ({ ...s, [cid]: e.target.value }))}></textarea>
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
            <textarea disabled={!canEditEvaluation} rows="6" className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Observations générales sur le travail..." value={form.generalComment} onChange={e => setForm({ ...form, generalComment: e.target.value })}></textarea>
            <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-slate-900/40">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Repère visuel de cette copie (optionnel)
              </h4>
              <MarkerStyleControls
                idPrefix="eval-marker"
                disabled={!canEditEvaluation}
                color={form.markerColor}
                icon={form.markerIcon}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500" htmlFor="eval-date-input">Date de l&apos;évaluation</label>
                <input
                  id="eval-date-input"
                  type="date"
                  className="eval-form-control w-full min-w-0 h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm box-border bg-white text-gray-900"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex h-10 w-full items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 rounded-lg cursor-pointer hover:bg-gray-100 transition box-border">
                  <input
                    type="checkbox"
                    checked={showDatePdf}
                    onChange={(e) => setShowDatePdf(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                  />
                  Afficher la date sur le PDF
                </label>
              </div>
            </div>
          </div>

          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {teamCorrectionMode
                ? "Historique des étudiants sélectionnés"
                : form.studentId
                  ? "Historique de l'étudiant"
                  : "Historique Récent"}
            </h3>
            <ul className="divide-y divide-gray-100">
              {(
                teamCorrectionMode
                  ? items.filter((it) => {
                      const sid = evalStudentId(it);
                      return sid && teamSelectedStudentIds.includes(String(sid));
                    })
                  : form.studentId
                    ? items.filter((it) => String(evalStudentId(it) || "") === String(form.studentId))
                    : items
              ).slice(0, 10).map((it) => (
                <li key={it._id} className="py-2 flex justify-between items-center group">
                  <div className="flex flex-1 cursor-pointer items-center gap-2" onClick={() => loadEvaluation(it._id)}>
                    {(() => {
                      const sid = evalStudentId(it);
                      const stu = sid ? students.find((s) => String(s._id) === String(sid)) : null;
                      const gl = normalizeGroupLabel(stu?.group);
                      const gst = groupStyleByLabel[gl];
                      return (
                        <>
                          <MarkerBadge color={gst?.color} icon={gst?.icon} />
                          <MarkerBadge color={it.markerColor} icon={it.markerIcon} />
                        </>
                      );
                    })()}
                    <p className="text-sm text-gray-800 hover:text-blue-600 transition">
                      <strong>{it.studentName}</strong> <span className="text-gray-400 mx-2">•</span> {it.date}
                    </p>
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
        <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:sticky lg:top-24 lg:self-start space-y-6 h-fit">
          <div className="space-y-6">

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center relative overflow-visible isolate">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-teal-400"></div>
              <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left relative z-20">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Étudiant</p>
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                      checked={teamCorrectionMode}
                      onChange={(e) => toggleTeamCorrectionMode(e.target.checked)}
                    />
                    Correction en équipe
                  </label>
                </div>
                {!teamCorrectionMode ? (
                  <StudentSelectWithIcons
                    students={studentsForPicker}
                    valueStudentId={form.studentId}
                    onSelectStudent={({ studentId, studentName }) => {
                      void syncEvaluationForStudentAndRubric(studentId, studentName, form.rubric);
                    }}
                    correctedIdsForExam={correctedStudentIdsForActiveExam}
                    hasActiveRubric={Boolean(form.rubric)}
                    groupStyleByLabel={groupStyleByLabel}
                    wrapperClassName="relative w-full min-w-0 z-30"
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white">
                      {studentsForPicker.map((s) => {
                        const sid = String(s._id);
                        const checked = teamSelectedStudentIds.includes(sid);
                        const isCorrectedForExam = Boolean(
                          correctedStudentIdsForActiveExam && correctedStudentIdsForActiveExam.has(sid)
                        );
                        return (
                          <label key={sid} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-blue-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleTeamStudent(sid, e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                            />
                            <span className="min-w-0 flex-1 truncate">{studentDisplayName(s)}</span>
                            {form.rubric && (
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  isCorrectedForExam
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-900"
                                }`}
                                title={isCorrectedForExam ? "Corrigé pour cet examen" : "Pas encore corrigé pour cet examen"}
                              >
                                {isCorrectedForExam ? "Corrigé" : "À corriger"}
                              </span>
                            )}
                          </label>
                        );
                      })}
                      {studentsForPicker.length === 0 && (
                        <div className="px-2 py-2 text-xs text-gray-500">Aucun étudiant dans ce filtre.</div>
                      )}
                    </div>
                    <div className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900">
                      <span className="font-semibold">{teamSelectedStudentIds.length}</span> étudiant(s) sélectionné(s)
                      {selectedTeamStudents.length > 0 ? (
                        <div className="mt-1 truncate text-blue-700" title={selectedTeamStudents.map((s) => studentDisplayName(s)).join(", ")}>
                          {selectedTeamStudents.map((s) => studentDisplayName(s)).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Note Finale</h2>
              <div className="flex items-end justify-center gap-1 mb-4">
                <span className="text-6xl font-extrabold text-gray-900 tracking-tighter">{Math.round(totalScore * 10) / 10}</span>
                <span className="text-2xl font-medium text-gray-400 mb-2">/ {totalMax}</span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
                <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${barColor}`} style={{ width: `${pct}%` }}></div>
              </div>

              <div className="relative z-0 h-48 w-full flex justify-center">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 grid gap-3">
              <button disabled={!canEditEvaluation} onClick={handleCreate} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-3 disabled:opacity-45 disabled:cursor-not-allowed">
                <i className="fa-solid fa-save"></i> {teamCorrectionMode ? "Enregistrer pour la sélection" : "Enregistrer l'évaluation"}
              </button>
              <button disabled={!canEditEvaluation || teamCorrectionMode} title={teamCorrectionMode ? "Désactivez le mode équipe pour générer un PDF individuel." : ""} onClick={handleDownloadPDF} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-medium py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-3 border border-slate-500/40 dark:bg-indigo-900/90 dark:hover:bg-indigo-800 dark:border-indigo-400/25 disabled:opacity-45 disabled:cursor-not-allowed">
                <i className="fa-solid fa-file-pdf"></i> Enregistrer & Télécharger PDF
              </button>
              <button
                disabled={!canEditEvaluation}
                onClick={() => {
                  if (hasEvaluationChanges && !window.confirm("Réinitialiser ?")) return;
                  setScores({});
                  setSubScores({});
                  setComments({});
                  if (teamCorrectionMode) {
                    setTeamSelectedStudentIds([]);
                    setForm({ ...form, _id: undefined, generalComment: "", markerColor: "", markerIcon: "" });
                  } else {
                    setForm({
                      ...form,
                      studentId: "",
                      studentName: "",
                      generalComment: "",
                      markerColor: "",
                      markerIcon: "",
                    });
                  }
                  lastCommittedEvalRef.current = captureEvalSnapshot({
                    form: teamCorrectionMode
                      ? { ...form, _id: undefined, generalComment: "", markerColor: "", markerIcon: "" }
                      : {
                          ...form,
                          studentId: "",
                          studentName: "",
                          generalComment: "",
                          markerColor: "",
                          markerIcon: "",
                        },
                    scores: {},
                    subScores: {},
                    comments: {},
                  });
                }}
                className="w-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-rotate-right"></i> Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>
        )}

        {evalPageTab === "suivi" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Suivi d&apos;évaluation {hubSelectedGroup ? `• ${hubSelectedGroup}` : ""}
              </h2>
              <button
                type="button"
                onClick={() => setEvalTab("corriger")}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Ouvrir l&apos;éditeur de correction
              </button>
            </div>
            {!emailBatchConfig.rubricId && (
              <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200">
                Sélectionnez un examen dans la barre du haut pour afficher le tableau : une ligne par étudiant du périmètre actif (groupe ou tous), avec statut, date, note et actions.
              </div>
            )}
            {emailBatchConfig.rubricId && examsForSend.length === 0 && (
              <p className="mb-4 mt-2 text-xs text-amber-800 dark:text-amber-200">Aucun examen avec correction dans ce périmètre — importez ou corrigez d&apos;abord une copie.</p>
            )}

            {emailBatchConfig.rubricId && (
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-slate-600/50">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-800 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("name")}
                            className="inline-flex items-center gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Étudiant
                            {hubEvalSort.key === "name" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-xs text-slate-400 dark:text-slate-500" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("status")}
                            className="inline-flex items-center gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Statut
                            {hubEvalSort.key === "status" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-xs text-slate-400 dark:text-slate-500" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("date")}
                            className="inline-flex items-center gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Date
                            {hubEvalSort.key === "date" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-xs text-slate-400 dark:text-slate-500" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("score")}
                            className="inline-flex items-center gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Résultat
                            {hubEvalSort.key === "score" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-xs text-slate-400 dark:text-slate-500" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleHubEvalSort("email")}
                            className="inline-flex items-center gap-1.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Copie (courriel)
                            {hubEvalSort.key === "email" ? (
                              <i className={`fa-solid text-blue-600 text-xs ${hubEvalSort.dir === "asc" ? "fa-sort-up" : "fa-sort-down"}`} aria-hidden />
                            ) : (
                              <i className="fa-solid fa-sort text-xs text-slate-400 dark:text-slate-500" aria-hidden />
                            )}
                          </button>
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/80">
                      {hubEvalSortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            Aucun étudiant pour ce filtre (groupe actif ou liste vide).
                          </td>
                        </tr>
                      ) : (
                        hubEvalSortedRows.map((row) => {
                          const hasMail = !!(row.student.email || "").trim();
                          const st = row.delivery?.status;
                          return (
                          <tr
                            key={row.student._id}
                            className="transition-colors even:bg-slate-50/60 hover:bg-blue-50/40 dark:even:bg-slate-800/35 dark:hover:bg-indigo-950/40"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <MarkerBadge
                                  color={groupStyleByLabel[normalizeGroupLabel(row.student.group)]?.color}
                                  icon={groupStyleByLabel[normalizeGroupLabel(row.student.group)]?.icon}
                                />
                                <MarkerBadge color={row.evaluation?.markerColor} icon={row.evaluation?.markerIcon} />
                                <span>{studentDisplayName(row.student)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  row.corrected
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                    : "bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100"
                                }`}
                              >
                                {row.corrected ? "Corrigé" : "À corriger"}
                              </span>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{row.dateStr || "—"}</td>
                            <td className="px-4 py-3">
                              {row.evaluation ? (
                                <span className="tabular-nums">
                                  <span className="font-semibold text-blue-800 dark:text-blue-300">
                                    {row.evaluation.totalScore}/{row.evaluation.totalMax}
                                  </span>
                                  {row.pct != null && (
                                    <span className="ml-2 text-slate-500 dark:text-slate-400">({Math.round(row.pct)}%)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col items-start gap-2">
                                {!row.corrected ? (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                                ) : !hasMail ? (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                    Pas d&apos;e-mail
                                  </span>
                                ) : st === "sent" ? (
                                  <span
                                    className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                    title={row.delivery?.sentAt ? String(row.delivery.sentAt) : undefined}
                                  >
                                    Envoyé
                                  </span>
                                ) : st === "failed" ? (
                                  <span
                                    className="inline-flex max-w-[14rem] rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-900 dark:bg-red-950/45 dark:text-red-100"
                                    title={row.delivery?.lastError || undefined}
                                  >
                                    Échec
                                  </span>
                                ) : st === "queued" ? (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100">
                                    En file
                                  </span>
                                ) : st === "skipped" ? (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    Ignoré
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                                    Non envoyé
                                  </span>
                                )}
                                {row.evaluation && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.evaluation ? (
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Link
                                    to={`/evaluations?load=${row.evaluation._id}&tab=corriger`}
                                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    Voir
                                  </Link>
                                  <Link
                                    to={`/evaluations?load=${row.evaluation._id}&download=true&tab=corriger`}
                                    className="text-slate-700 hover:underline dark:text-slate-300"
                                  >
                                    PDF
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => deleteEval(row.evaluation._id)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Suppr.
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {evalPageTab === "envois" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-white/10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Envois de copies</h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {hubSelectedGroup
                    ? `Groupe « ${hubSelectedGroup} » — sélectionnez un examen dans la barre du haut, puis « Nouvel envoi »`
                    : "Tous les groupes — sélectionnez un groupe, puis un examen dans la barre du haut"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/admin/users"
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/35 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                >
                  Administration
                </Link>
                <button
                  type="button"
                  onClick={openEmailSendModal}
                  disabled={!emailBatchConfig.rubricId || !examsForSend.length}
                  title={!emailBatchConfig.rubricId ? "Sélectionnez d’abord un examen dans la barre du haut" : ""}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg"
                >
                  <i className="fa-solid fa-paper-plane mr-2" aria-hidden />
                  Nouvel envoi
                </button>
              </div>
            </div>

            {!hubSelectedGroup && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200">
                Choisissez un <strong>groupe actif</strong> dans la barre du haut pour afficher, par examen, combien d&apos;étudiants sont corrigés et combien de copies ont été envoyées.
              </div>
            )}

            {hubSelectedGroup && examsForSend.length === 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200">
                Aucun examen avec des corrections pour le groupe « {hubSelectedGroup} ». Seuls les examens avec au moins une copie corrigée apparaissent en cartes.
              </div>
            )}

            {hubSelectedGroup && emailBatchConfig.rubricId && selectedEnrollSendSummary && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/60">
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Copies corrigées :</span>{" "}
                  {selectedEnrollSendSummary.correctedCount}/{selectedEnrollSendSummary.totalStudents}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Copies envoyées :</span> {selectedEnrollSendSummary.sentCopies}
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectionModalRow(selectedEnrollSendSummary)}
                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/50"
                  title="Voir la liste des étudiants corrigés et à corriger"
                >
                  Détail corrigés / à corriger
                </button>
              </div>
            )}

            {!!emailJob.jobId && (
              <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
                <div className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
                  Job {emailJob.jobId} ({emailJob.status || "queued"})
                </div>
                <div>
                  {emailJob.processed}/{emailJob.total} traités • envoyés {emailJob.sent || 0} • échecs {emailJob.failed || 0} • ignorés {emailJob.skipped || 0}
                </div>
              </div>
            )}
            {emailBatchConfig.rubricId && (
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-slate-600/50">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-800 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Étudiant</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Courriel</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Statut envoi</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Date d&apos;envoi</th>
                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/80">
                      {hubEvalSortedRows.map((row) => {
                        const evId = row.evaluation?._id;
                        const hasMail = !!(row.student.email || "").trim();
                        const st = row.delivery?.status;
                        const sendBusy = evId != null && hubSendBusyId != null && String(hubSendBusyId) === String(evId);
                        const canSend = !!row.evaluation && hasMail && st !== "queued" && !sendBusy;
                        const sentAt = row.delivery?.sentAt || "";
                        return (
                          <tr key={`send-grid-${row.student._id}`} className="transition-colors even:bg-slate-50/60 hover:bg-blue-50/40 dark:even:bg-slate-800/35 dark:hover:bg-indigo-950/40">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <MarkerBadge
                                  color={groupStyleByLabel[normalizeGroupLabel(row.student.group)]?.color}
                                  icon={groupStyleByLabel[normalizeGroupLabel(row.student.group)]?.icon}
                                />
                                <MarkerBadge color={row.evaluation?.markerColor} icon={row.evaluation?.markerIcon} />
                                <span>{studentDisplayName(row.student)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.student.email || "—"}</td>
                            <td className="px-4 py-3">
                              {!row.corrected ? (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100">À corriger</span>
                              ) : !hasMail ? (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Pas d&apos;e-mail</span>
                              ) : st === "sent" ? (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Envoyé</span>
                              ) : st === "failed" ? (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-900 dark:bg-red-950/45 dark:text-red-100">Échec</span>
                              ) : st === "queued" ? (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100">En file</span>
                              ) : (
                                <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">Non envoyé</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {sentAt ? (
                                <span className="tabular-nums">
                                  {new Date(sentAt).toLocaleString("fr-CA", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {row.evaluation && (
                                  <button
                                    type="button"
                                    disabled={!canSend}
                                    onClick={() => sendEvalEmailFromHub(row.evaluation._id)}
                                    className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/50"
                                  >
                                    {sendBusy ? "Envoi…" : "Envoyer"}
                                  </button>
                                )}
                                {row.delivery?.status === "failed" && row.delivery?.jobId && (
                                  <button
                                    type="button"
                                    onClick={() => retryFailed(row.delivery.jobId)}
                                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/40"
                                  >
                                    Relancer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {hubEvalSortedRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                            Aucun étudiant pour ce filtre (groupe actif ou liste vide).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!!effectiveLogJobId && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-600/50">
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2 dark:bg-slate-800">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Logs envoi {emailJob.jobId ? "en cours" : "récents"}
                  </div>
                  <button
                    type="button"
                    onClick={clearEmailLogs}
                    className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Supprimer les logs
                  </button>
                </div>
                <ul className="max-h-[30vh] divide-y divide-slate-200 overflow-auto text-sm dark:divide-slate-700">
                  {emailJobLogs.map((d) => {
                    const who = (d.studentId && studentDisplayName(d.studentId)) || d.evaluationId?.studentName || "Étudiant";
                    const ts = d.updatedAt || d.createdAt || d.sentAt || "";
                    return (
                      <li key={`joblog-${d._id}`} className="px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{who}</span>
                          <span
                            className={`text-xs font-semibold ${
                              d.status === "sent"
                                ? "text-emerald-600 dark:text-emerald-300"
                                : d.status === "failed"
                                  ? "text-red-600 dark:text-red-300"
                                  : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {ts ? new Date(ts).toLocaleString("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                        </div>
                        {d.lastError ? (
                          <div className="mt-1 text-xs text-red-600 dark:text-red-300">{d.lastError}</div>
                        ) : null}
                      </li>
                    );
                  })}
                  {emailJobLogs.length === 0 && (
                    <li className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      En attente des premières entrées de log pour ce job.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {correctionModalRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setCorrectionModalRow(null)}
          role="presentation"
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:!bg-slate-900 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Étudiants corrigés · détail</h2>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  {correctionModalLists.title}
                  {hubSelectedGroup ? ` · groupe « ${hubSelectedGroup} »` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModalRow(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
              <div className="flex min-h-0 flex-col rounded-xl border border-emerald-200/90 bg-emerald-50/50 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/35 dark:ring-1 dark:ring-emerald-500/10">
                <h3 className="mb-2 shrink-0 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Corrigés ({correctionModalLists.corrected.length})
                </h3>
                <ul className="modal-student-list max-h-[min(40vh,320px)] divide-y divide-emerald-200/70 overflow-y-auto pr-1 text-sm dark:divide-emerald-800/50">
                  {correctionModalLists.corrected.map((s) => (
                    <li key={s._id} className="py-2.5 text-slate-800 dark:text-slate-100">
                      {studentDisplayName(s)}
                      {s.email ? <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{s.email}</span> : null}
                    </li>
                  ))}
                  {correctionModalLists.corrected.length === 0 && (
                    <li className="py-2 text-xs text-slate-500 dark:text-slate-400">Aucun pour cet examen.</li>
                  )}
                </ul>
              </div>
              <div className="flex min-h-0 flex-col rounded-xl border border-amber-200/90 bg-amber-50/50 p-3 dark:border-sky-400/35 dark:bg-slate-900/70 dark:ring-1 dark:ring-sky-500/15">
                <h3 className="mb-2 shrink-0 text-sm font-semibold text-amber-950 dark:text-sky-100">
                  Pas encore corrigés ({correctionModalLists.pending.length})
                </h3>
                <ul className="modal-student-list max-h-[min(40vh,320px)] divide-y divide-amber-200/80 overflow-y-auto pr-1 text-sm dark:divide-slate-700/80">
                  {correctionModalLists.pending.map((s) => (
                    <li key={s._id} className="py-2.5 text-slate-800 dark:text-slate-100">
                      {studentDisplayName(s)}
                      {s.email ? <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{s.email}</span> : null}
                    </li>
                  ))}
                  {correctionModalLists.pending.length === 0 && (
                    <li className="py-2 text-xs text-slate-500 dark:text-slate-400">Tous sont corrigés.</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="flex shrink-0 justify-end rounded-b-2xl border-t border-gray-100 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-950/80">
              <button
                type="button"
                onClick={() => setCorrectionModalRow(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm hover:bg-slate-50 dark:!bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowEmailModal(false)}
          role="presentation"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:border dark:border-indigo-500/25 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
              <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Envoi des copies par lot</h2>
              <button type="button" onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Fermer">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm dark:border-emerald-300/50 dark:bg-teal-950/45">
                <div className="mb-1 text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">Examen</div>
                <div className="font-medium text-gray-900 dark:text-slate-100">
                  {selectedSendExam ? `${selectedSendExam.taskTitle || selectedSendExam.title} (v${selectedSendExam.version})` : "—"}
                </div>
                {selectedSendExam?.title && selectedSendExam?.taskTitle && selectedSendExam.title !== selectedSendExam.taskTitle && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">{selectedSendExam.title}</div>
                )}
              </div>
              <label className="block text-sm text-gray-700 dark:text-slate-200">
                Groupe destinataire
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                  value={emailBatchConfig.group}
                  onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, group: e.target.value })}
                >
                  {emailTargets.groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={emailBatchConfig.skipAlreadySent}
                  onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, skipAlreadySent: e.target.checked })}
                />
                Ignorer les copies déjà envoyées
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={emailBatchConfig.allowResendFailed}
                  onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, allowResendFailed: e.target.checked })}
                />
                Relancer les copies en erreur
              </label>
              <label className="text-sm text-gray-700 dark:text-slate-200">
                Délai entre chaque email (ms)
                <input
                  type="number"
                  min="0"
                  max="10000"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                  value={emailBatchConfig.delayMs}
                  onChange={(e) => setEmailBatchConfig({ ...emailBatchConfig, delayMs: Number(e.target.value || 0) })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950/50">
              <button type="button" onClick={() => setShowEmailModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                Fermer
              </button>
              <button type="button" onClick={startEmailBatch} className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                Lancer l&apos;envoi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF TEMPLATE */}
      <div ref={pdfTemplateRef} className="hidden">
        <div
          id="pdf-content"
          className="pdf-forced-light p-8 bg-white max-w-4xl mx-auto text-gray-800"
        >
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
                <div key={cid} className="flex border-b border-gray-100 py-3">
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
                                <span className={isChecked ? "text-gray-800 font-medium" : "text-gray-600"}>
                                  {sc.label} ({sc.pts > 0 ? "+" : ""}
                                  {sc.pts} pts)
                                </span>
                              </div>
                              {!isChecked && sc.feedback && (
                                <p className="text-xs text-red-700 ml-6 italic mt-0.5 rounded border border-red-200 bg-red-50 px-2 py-1 leading-snug">
                                  ⚠ {sc.feedback}
                                </p>
                              )}
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
