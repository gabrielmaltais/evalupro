import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { normalizeImportedRubric, parseAiJson, tasksTotal, unwrapAiTemplateEnvelope } from "../lib/rubricTemplate";
import { buildAITemplate as buildAITemplateJson, DEFAULT_AI_CONFIG, isTemplatePlaceholder, LEVEL_SCALES } from "../lib/aiTemplate";
import { alignCriteriaToCourse, competenciesForAi } from "../lib/courseHelpers";
import PageSectionTitle from "../components/PageSectionTitle";
import { Chip } from "../components/ui";
import CoursePicker from "../components/CoursePicker";
import { useSession } from "../lib/sessionState";

const DEFAULT_CRITERION = {
  id: "cx",
  title: "Nouveau Critère",
  competencyElement: "",
  weight: 10,
  color: "border-blue-500",
  levels: LEVEL_SCALES[4].map((l) => ({ ...l, desc: "Description..." })),
};

export default function AdminRubric() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { active } = useSession();
  // Liaison avec la session en cours: cours de la session (et évaluations importées) et ses groupes.
  const [sessionEntries, setSessionEntries] = useState([]);
  const [useInSession, setUseInSession] = useState(true);
  const [sessionDirty, setSessionDirty] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const presetCourse = searchParams.get("course") || "";
  const [rubrics, setRubrics] = useState([]);
  const [rubricFilterCourse, setRubricFilterCourse] = useState(presetCourse);
  const [importing, setImporting] = useState(null);
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const presetRubricDone = useRef(false);
  const [rubricSearch, setRubricSearch] = useState("");
  const [rubricFilterGroup, setRubricFilterGroup] = useState("");
  const [rubricFilterStatus, setRubricFilterStatus] = useState("all");
  const [rubricSortBy, setRubricSortBy] = useState("updatedAt_desc");
  
  // Form State
  const [title, setTitle] = useState("Nouvelle Évaluation");
  const [taskTitle, setTaskTitle] = useState("Tâche Finale");
  const [version, setVersion] = useState(1);
  const [groups, setGroups] = useState([]);
  const [criteria, setCriteria] = useState([{ ...DEFAULT_CRITERION, id: "c1" }]);
  const [isActive, setIsActive] = useState(true);
  const [linkCompetencies, setLinkCompetencies] = useState(false);
  const [courseId, setCourseId] = useState(presetCourse);
  const [duplicating, setDuplicating] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const DEFAULT_FEEDBACK = [
    { minPct: 0, maxPct: 60, message: "Tu n'y es pas encore, mais ne te décourage pas ! Reviens sur les points manquants, consulte tes notes et n'hésite pas à demander de l'aide. Tu as la capacité de progresser et c'est en persévérant qu'on réussit." },
    { minPct: 60, maxPct: 75, message: "C'est un début ! Tu as saisi les bases, mais certains éléments méritent d'être approfondis. Prends le temps de revoir les points manqués — tu es sur la bonne voie pour t'améliorer." },
    { minPct: 75, maxPct: 85, message: "Beau travail ! Tu démontres une bonne maîtrise de l'ensemble du sujet. Quelques détails peuvent encore être peaufinés, mais tu peux être fier·e de ta performance." },
    { minPct: 85, maxPct: 95, message: "Excellent travail ! Tu maîtrises très bien la matière et ton investissement est visible. Continue comme ça, tu t'approches de la perfection !" },
    { minPct: 95, maxPct: 100, message: "Extraordinaire ! 🎉 Tu as accompli un travail remarquable et exceptionnel. C'est le résultat d'un effort soutenu et d'une vraie rigueur. Félicitations sincères !" },
  ];
  const [feedbackMessages, setFeedbackMessages] = useState(DEFAULT_FEEDBACK);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");

  // AI Modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiCopySuccess, setAiCopySuccess] = useState(false);
  const [showPasteJsonModal, setShowPasteJsonModal] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState("");
  const [courses, setCourses] = useState([]);
  // Le cours du gabarit est toujours celui de l'éditeur (étape 1): une seule source, jamais de décalage.
  const [aiConfig, setAiConfig] = useState(DEFAULT_AI_CONFIG);
  const [courseNotice, setCourseNotice] = useState("");

  async function refresh() {
    try {
      const [data, dashboard] = await Promise.all([
        api.listRubrics(),
        api.getStudentGroupDashboard(),
      ]);
      setRubrics(data);
      const wanted = searchParams.get("rubric");
      if (wanted && !presetRubricDone.current) {
        presetRubricDone.current = true;
        const found = data.find((x) => x._id === wanted);
        if (found) selectRubric(found);
      }
      setGroupOptions((dashboard || []).filter((x) => x.groupId).map((x) => x.group));
      await loadSessionLinks();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function loadSessionLinks() {
    if (!active?._id) return;
    setSessionEntries(await api.listSessionCourses(active._id));
  }

  useEffect(() => {
    refresh();
  }, []);

  // La session active peut arriver après le premier chargement.
  useEffect(() => {
    loadSessionLinks().catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?._id]);

  // Bouton « Nouvelle évaluation » de l'en-tête: ?new=1 ouvre l'éditeur vide.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    startNew();
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sessionEntry = sessionEntries.find((e) => String(e.course._id) === String(courseId));
  const importedHere = (rid) => sessionEntries.some((e) => e.rubrics.some((r) => String(r._id) === String(rid) && r.imported));
  // Valeurs par défaut de la section session, recalculées quand on change d'évaluation ou de cours.
  const wantedKey = `${selectedId || "new"}|${courseId}|${sessionEntries.length}`;
  if (sessionKey !== wantedKey) {
    setSessionKey(wantedKey);
    setUseInSession(selectedId ? importedHere(selectedId) : true);
    setSessionDirty(false);
  }

  /** Après l'enregistrement: l'évaluation est cochée (ou décochée) dans la session. */
  async function applySessionLinks(rid) {
    if (!active?._id || active.archivedAt || !courseId) return;
    const entry = sessionEntries.find((e) => String(e.course._id) === String(courseId));
    const imported = entry ? entry.rubrics.filter((r) => r.imported).map((r) => String(r._id)) : [];
    if (useInSession) {
      if (!entry) await api.addSessionCourse(active._id, courseId, [rid]);
      else if (!imported.includes(String(rid))) await api.setSessionCourseRubrics(active._id, courseId, [...imported, String(rid)]);
    } else if (imported.includes(String(rid))) {
      await api.setSessionCourseRubrics(active._id, courseId, imported.filter((id) => id !== String(rid)));
    }
    await loadSessionLinks();
    setSessionDirty(false);
  }

  // Cours (et leurs compétences) proposés dans le configurateur de gabarit.
  useEffect(() => {
    api.listCourses().then(setCourses).catch(() => setCourses([]));
  }, []);


  function buildSnapshot(next = {}) {
    const snap = {
      selectedId: next.selectedId ?? selectedId ?? null,
      title: next.title ?? title,
      taskTitle: next.taskTitle ?? taskTitle,
      version: next.version ?? version,
      groups: next.groups ?? groups,
      isActive: next.isActive ?? isActive,
      linkCompetencies: next.linkCompetencies ?? linkCompetencies,
      courseId: next.courseId ?? courseId,
      criteria: next.criteria ?? criteria,
      feedbackMessages: next.feedbackMessages ?? feedbackMessages,
    };
    return JSON.stringify(snap);
  }

  const hasUnsavedChanges = useMemo(
    () => buildSnapshot() !== savedSnapshot,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, title, taskTitle, version, groups, isActive, linkCompetencies, courseId, criteria, feedbackMessages, savedSnapshot]
  );

  useEffect(() => {
    if (savedSnapshot) return;
    setSavedSnapshot(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSnapshot]);

  function selectRubric(r) {
    setCourseNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setEditorOpen(true);
    setSelectedId(r._id);
    setTitle(r.title || "");
    setTaskTitle(r.taskTitle || "");
    setVersion((r.version || 1) + 1); // Auto increment version for new save
    setGroups(Array.isArray(r.groups) && r.groups.length ? r.groups : (r.group ? [r.group] : []));
    setCriteria(r.criteria || []);
    setIsActive(r.isActive !== false);
    setLinkCompetencies(r.linkCompetencies === true);
    setCourseId(r.course || "");
    setFeedbackMessages(r.feedbackMessages && r.feedbackMessages.length > 0 ? r.feedbackMessages : DEFAULT_FEEDBACK);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    setSavedSnapshot(
      buildSnapshot({
        selectedId: r._id,
        title: r.title || "",
        taskTitle: r.taskTitle || "",
        version: (r.version || 1) + 1,
        groups: Array.isArray(r.groups) && r.groups.length ? r.groups : (r.group ? [r.group] : []),
        isActive: r.isActive !== false,
        linkCompetencies: r.linkCompetencies === true,
        courseId: r.course || "",
        criteria: r.criteria || [],
        feedbackMessages: r.feedbackMessages && r.feedbackMessages.length > 0 ? r.feedbackMessages : DEFAULT_FEEDBACK,
      })
    );
  }

  function startNew() {
    setCourseNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setEditorOpen(true);
    setSelectedId(null);
    setTitle("Nouvelle Évaluation");
    setTaskTitle("Tâche");
    setVersion(1);
    setGroups([]);
    setCriteria([{ ...DEFAULT_CRITERION, id: "c1" }]);
    setIsActive(true);
    setLinkCompetencies(false);
    setCourseId(rubricFilterCourse || presetCourse || "");
    setFeedbackMessages(DEFAULT_FEEDBACK);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    setSavedSnapshot(
      buildSnapshot({
        selectedId: null,
        title: "Nouvelle Évaluation",
        taskTitle: "Tâche",
        version: 1,
        groups: [],
        isActive: true,
        linkCompetencies: false,
        courseId: rubricFilterCourse || presetCourse || "",
        criteria: [{ ...DEFAULT_CRITERION, id: "c1" }],
        feedbackMessages: DEFAULT_FEEDBACK,
      })
    );
  }

  async function save() {
    setError("");
    setSuccess("");
    if (!courseId) {
      setError("Choisis le cours dans lequel classer cette grille.");
      return;
    }
    try {
      const payload = { title: selectedCourse?.title || title, taskTitle, version, criteria, isActive, linkCompetencies, course: courseId, feedbackMessages };
      let rid = selectedId;
      if (selectedId) {
        await api.updateRubric(selectedId, payload);
      } else {
        rid = (await api.createRubric(payload))._id;
        setSelectedId(rid);
      }
      await applySessionLinks(rid);
      setSuccess(
        `${selectedId ? "Évaluation enregistrée." : "Nouvelle évaluation créée."}` +
          (active && useInSession ? ` Elle est à corriger dans la session « ${active.name} ».` : "")
      );
      setSavedSnapshot(buildSnapshot());
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function closeEditor() {
    if (hasUnsavedChanges && !window.confirm("Quitter sans enregistrer les modifications ?")) return;
    startNew();
    setEditorOpen(false);
  }

  async function archiveRubric() {
    if (!selectedId) return;
    try {
      await api.archiveRubric(selectedId);
      startNew();
      setEditorOpen(false);
      await refresh();
      setSuccess("Évaluation archivée. Tu peux la restaurer dans Ressources › Sessions › Archives.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function removeRubric() {
    if (!selectedId) return;
    try {
      await api.deleteRubric(selectedId);
      startNew();
      setEditorOpen(false);
      await refresh();
      setSuccess("Évaluation supprimée avec succès !");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  function updateCriterion(idx, field, value) {
    const newC = [...criteria];
    newC[idx] = { ...newC[idx], [field]: value };
    setCriteria(newC);
  }

  function updateLevel(cIdx, lIdx, field, value) {
    const newC = [...criteria];
    const newLevels = [...newC[cIdx].levels];
    newLevels[lIdx] = { ...newLevels[lIdx], [field]: value };
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function addCriterion() {
    setCriteria([...criteria, { ...DEFAULT_CRITERION, id: `c${Date.now()}` }]);
  }

  function removeCriterion(idx) {
    setCriteria(criteria.filter((_, i) => i !== idx));
  }

  function addLevel(cIdx) {
    const newC = [...criteria];
    const newLevels = [...(newC[cIdx].levels || [])];
    newLevels.push({ label: "Nouveau", minPct: 1, maxPct: 1, desc: "" });
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function removeLevel(cIdx, lIdx) {
    const newC = [...criteria];
    const newLevels = [...newC[cIdx].levels];
    newLevels.splice(lIdx, 1);
    newC[cIdx] = { ...newC[cIdx], levels: newLevels };
    setCriteria(newC);
  }

  function addSC(cIdx) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), label: 'Nouvelle tâche', pts: 1 });
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function updateSC(cIdx, scIdx, field, val) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC[scIdx] = { ...newSC[scIdx], [field]: val };
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function removeSC(cIdx, scIdx) {
    const newC = [...criteria];
    const newSC = [...(newC[cIdx].subCriteria || [])];
    newSC.splice(scIdx, 1);
    newC[cIdx] = { ...newC[cIdx], subCriteria: newSC };
    setCriteria(newC);
  }

  function exportJSON() {
    const data = { title, taskTitle, version, group: groups[0] || "", groups, criteria, isActive, linkCompetencies, feedbackMessages };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Grille_${(taskTitle || title || 'sans_titre').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const selectedCourse = courses.find((c) => c._id === courseId) || null;
  const selectedCourseCompetencies = competenciesForAi(selectedCourse);
  const buildAITemplate = () => buildAITemplateJson({ ...aiConfig, courseId, course: selectedCourse });

  /**
   * Change le cours de l'évaluation. Les critères liés aux compétences de l'ancien cours sont rattachés à celles
   * du nouveau cours quand le titre correspond, sinon le lien est coupé (le texte reste): jamais de lien orphelin.
   */
  function changeCourse(nextId) {
    if (nextId === courseId) return;
    const next = courses.find((c) => c._id === nextId);
    const hadLinks = criteria.some((c) => c.competencyId);
    const al = alignCriteriaToCourse(criteria, next?.competencies);
    setCourseId(nextId);
    if (next) setTitle(next.title);
    if (hadLinks || al.linked) setCriteria(al.criteria);
    if (hadLinks) {
      const lost = criteria.filter((c) => c.competencyId).length - al.linked;
      setCourseNotice(
        lost > 0
          ? `Cours changé : ${al.linked} critère(s) rattaché(s) aux compétences de « ${next?.title || "ce cours"} », ${lost} détaché(s) (leur texte est conservé).`
          : `Cours changé : les ${al.linked} critère(s) sont rattachés aux compétences de « ${next?.title} ».`
      );
    } else {
      setCourseNotice("");
    }
  }

  /** Ajoute un critère vide pour chaque compétence du cours qu'aucun critère ne couvre. */
  function addMissingCompetencies() {
    const al = alignCriteriaToCourse(criteria, selectedCourse?.competencies);
    const fresh = al.missing.map((comp, i) => ({
      ...DEFAULT_CRITERION,
      id: `c${criteria.length + i + 1}-${comp.id}`.slice(0, 60),
      title: comp.title,
      competencyElement: comp.title,
      competencyId: comp.id,
      weight: 10,
      subCriteria: [],
    }));
    setCriteria([...al.criteria, ...fresh]);
    setLinkCompetencies(true);
  }

  function openAiConfigurator() {
    if (!showEditor) startNew();
    setShowAIModal(true);
  }

  function downloadAITemplate() {
    const cfg = aiConfig;
    const template = buildAITemplate();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `Gabarit_IA_EvaluPro_${cfg.langue}_${cfg.niveaux}niv.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowAIModal(false);
  }

  async function copyAITemplateToClipboard() {
    try {
      const template = buildAITemplate();
      await navigator.clipboard.writeText(JSON.stringify(template, null, 2));
      setAiCopySuccess(true);
      setTimeout(() => setAiCopySuccess(false), 2200);
      setSuccess("Gabarit IA copié dans le presse-papiers.");
      setError("");
    } catch {
      setError("Impossible de copier automatiquement. Vérifiez les permissions du navigateur.");
    }
  }

  function applyImportedRubric(json) {
    const result = normalizeImportedRubric(unwrapAiTemplateEnvelope(json), { defaultFeedbackMessages: DEFAULT_FEEDBACK });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    const imported = result.rubric;
    const course = courses.find((c) => c._id === courseId) || null;
    // Les critères sont rattachés aux compétences du cours choisi MAINTENANT (même si le cours a changé depuis la génération).
    const al = alignCriteriaToCourse(imported.criteria, course?.competencies);
    const placeholders = [
      ...imported.criteria.flatMap((c) => [
        ...(c.subCriteria || []).filter((t) => isTemplatePlaceholder(t.label) || isTemplatePlaceholder(t.feedback)).map(() => c.title),
        ...(c.levels || []).filter((l) => isTemplatePlaceholder(l.desc)).map(() => c.title),
      ]),
      ...(imported.feedbackMessages || []).filter((m) => isTemplatePlaceholder(m.message)).map(() => "rétroaction globale"),
    ];
    const keptName = !isTemplatePlaceholder(imported.taskTitle);
    if (!keptName) {
      // Le nom de l'évaluation est resté celui du gabarit: on garde ce que l'enseignant avait saisi.
      imported.taskTitle = taskTitle && !isTemplatePlaceholder(taskTitle) && taskTitle !== "Tâche" ? taskTitle : "";
    }
    setEditorOpen(true);
    setTitle(course ? course.title : imported.title);
    setTaskTitle(imported.taskTitle);
    setCriteria(al.criteria);
    setLinkCompetencies(imported.linkCompetencies === true || al.linked > 0);
    setVersion(1);
    setSelectedId(null);
    setFeedbackMessages(imported.feedbackMessages);
    setCourseNotice("");
    const notes = [
      ...result.warnings,
      ...result.aValider.filter((item) => !isTemplatePlaceholder(item)).map((item) => `À valider : ${item}`),
    ];
    if (!course) notes.push("Choisis le cours (étape 1) pour rattacher les critères à ses compétences.");
    else if (!(course.competencies || []).length) notes.push(`Le cours « ${course.title} » n'a pas de compétences : les critères ne sont pas rattachés.`);
    else {
      if (al.unlinked) notes.push(`${al.unlinked} critère(s) ne correspondent à aucune compétence de « ${course.title} » (titre modifié par l'IA ?).`);
      if (al.missing.length) notes.push(`Compétence(s) du cours sans critère : ${al.missing.map((c) => c.title).join(" ; ")}. Utilise « Ajouter les compétences manquantes ».`);
    }
    if (placeholders.length) notes.push(`Du texte du gabarit n'a pas été remplacé par l'IA (${[...new Set(placeholders)].join(" ; ")}).`);
    if (!imported.taskTitle) notes.push("Donne un nom à l'évaluation (étape 2).");
    setSuccess(
      `Évaluation importée : ${imported.criteria.length} critère(s), ${imported.criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0)} pts` +
        (course && al.linked ? `, ${al.linked} rattaché(s) aux compétences du cours.` : ".") +
        (notes.length ? `\n\nÀ vérifier avant d'enregistrer :\n- ${notes.join("\n- ")}` : "")
    );
    setError("");
    /* Ne pas réinitialiser savedSnapshot : sinon l'effet synchrone réécrit le snapshot avec le
       formulaire importé et l'UI affiche « tout enregistré » alors qu'aucun POST n'a eu lieu. */
    return true;
  }

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = parseAiJson(evt.target.result);
        applyImportedRubric(json);
      } catch {
        setError("Erreur de lecture du fichier JSON.");
      }
      e.target.value = null;
    };
    reader.readAsText(file);
  }

  function importFromPastedJson() {
    try {
      const json = parseAiJson(pastedJsonText);
      const ok = applyImportedRubric(json);
      if (ok) {
        setShowPasteJsonModal(false);
        setPastedJsonText("");
      }
    } catch {
      setError("JSON invalide. Vérifiez la syntaxe avant d'importer.");
    }
  }

  const courseLabel = (id) => {
    const c = courses.find((x) => x._id === id);
    return c ? `${c.code ? `${c.code} · ` : ""}${c.title}` : "Sans cours";
  };
  const totalPoints = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const filteredRubrics = useMemo(() => {
    const q = rubricSearch.trim().toLowerCase();
    const out = rubrics.filter((r) => {
      if (rubricFilterStatus === "active" && !r.isActive) return false;
      if (rubricFilterStatus === "inactive" && r.isActive) return false;
      if (rubricFilterCourse && r.course !== rubricFilterCourse) return false;
      if (rubricFilterGroup) {
        const list = Array.isArray(r.groups) && r.groups.length ? r.groups : (r.group ? [r.group] : []);
        if (!list.includes(rubricFilterGroup)) return false;
      }
      if (!q) return true;
      const hay = [r.title, r.taskTitle, (Array.isArray(r.groups) ? r.groups.join(" ") : r.group || "")].join(" ").toLowerCase();
      return hay.includes(q);
    });
    out.sort((a, b) => {
      if (rubricSortBy === "task_asc") return String(a.taskTitle || "").localeCompare(String(b.taskTitle || ""), "fr");
      if (rubricSortBy === "task_desc") return String(b.taskTitle || "").localeCompare(String(a.taskTitle || ""), "fr");
      if (rubricSortBy === "version_desc") return Number(b.version || 0) - Number(a.version || 0);
      if (rubricSortBy === "version_asc") return Number(a.version || 0) - Number(b.version || 0);
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
    // Classées par cours (le « dossier »), puis selon le tri choisi.
    const order = new Map(courses.map((c, i) => [c._id, i]));
    out.sort((a, b) => (order.get(a.course) ?? 1e9) - (order.get(b.course) ?? 1e9));
    return out;
  }, [courses, rubrics, rubricSearch, rubricFilterGroup, rubricFilterCourse, rubricFilterStatus, rubricSortBy]);

  const showEditor = editorOpen || Boolean(selectedId) || hasUnsavedChanges;

  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-4">
          <PageSectionTitle
            icon="fa-sliders"
            iconBgClass="bg-slate-700"
            title="Évaluations"
            subtitle="Chaque évaluation est rangée dans un cours. Crée-la, puis choisis si elle est à corriger cette session et par quels groupes."
          />
        </div>
        
        {/* LEFT COLUMN: List (cachée sur petit écran pendant l'édition, pour que le formulaire soit en haut) */}
        <div className={`lg:col-span-1 space-y-4 ${showEditor ? "hidden lg:block" : ""}`}>
          <button type="button" onClick={startNew} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            <i className="fa-solid fa-plus" aria-hidden /> Nouvelle évaluation
          </button>
          <div className="flex items-center gap-1.5">
            <span className="mr-auto text-xs font-semibold text-gray-500">Importer / exporter</span>
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" title="Importer un fichier JSON">
              <i className="fa-solid fa-upload text-xs" aria-hidden />
              <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
            </label>
            <button type="button" onClick={() => setShowPasteJsonModal(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" title="Coller un JSON">
              <i className="fa-solid fa-paste text-xs" aria-hidden />
            </button>
            <button type="button" onClick={() => setImporting({ target: rubricFilterCourse || courseId || "", source: "" })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" title="Copier une évaluation d'un autre cours">
              <i className="fa-solid fa-file-import text-xs" aria-hidden />
            </button>
            <button type="button" onClick={exportJSON} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" title="Exporter l'évaluation ouverte en JSON">
              <i className="fa-solid fa-download text-xs" aria-hidden />
            </button>
            <button type="button" onClick={openAiConfigurator} className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-600 hover:bg-purple-50" title="Créer avec une IA (gabarit)">
              <i className="fa-solid fa-robot text-xs" aria-hidden />
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 border-b border-gray-100">Mes évaluations</h3>
            <div className="space-y-2 border-b border-gray-100 bg-white px-3 py-3">
              <input
                type="text"
                value={rubricSearch}
                onChange={(e) => setRubricSearch(e.target.value)}
                placeholder="Rechercher une évaluation, un cours, un groupe..."
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="ui-label">Cours</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!rubricFilterCourse} onClick={() => setRubricFilterCourse("")} className="!min-h-0 !px-2.5 !py-1 !text-xs">Tous</Chip>
                  {courses.map((c) => (
                    <Chip key={`fc-${c._id}`} active={rubricFilterCourse === c._id} onClick={() => setRubricFilterCourse(rubricFilterCourse === c._id ? "" : c._id)} icon="fa-folder-open" className="!min-h-0 !px-2.5 !py-1 !text-xs">
                      {c.code ? `${c.code} · ` : ""}{c.title}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <span className="ui-label">Statut</span>
                <div className="flex flex-wrap gap-1.5">
                  {[["all", "Toutes"], ["active", "Actives"], ["inactive", "Inactives"]].map(([v, label]) => (
                    <Chip key={v} active={rubricFilterStatus === v} onClick={() => setRubricFilterStatus(v)} className="!min-h-0 !px-2.5 !py-1 !text-xs">{label}</Chip>
                  ))}
                </div>
              </div>
              {groupOptions.length > 0 && (
                <div>
                  <span className="ui-label">Groupe</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip active={!rubricFilterGroup} onClick={() => setRubricFilterGroup("")} className="!min-h-0 !px-2.5 !py-1 !text-xs">Tous</Chip>
                    {groupOptions.map((g) => (
                      <Chip key={`flt-${g}`} active={rubricFilterGroup === g} onClick={() => setRubricFilterGroup(rubricFilterGroup === g ? "" : g)} icon="fa-users" className="!min-h-0 !px-2.5 !py-1 !text-xs">{g}</Chip>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={rubricSortBy}
                  onChange={(e) => setRubricSortBy(e.target.value)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="updatedAt_desc">Récents</option>
                  <option value="task_asc">Tâche A → Z</option>
                  <option value="task_desc">Tâche Z → A</option>
                  <option value="version_desc">Version décroissante</option>
                  <option value="version_asc">Version croissante</option>
                </select>
              </div>
              <p className="text-[11px] text-gray-500">
                {filteredRubrics.length} / {rubrics.length} évaluation(s) affichée(s)
              </p>
            </div>
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {filteredRubrics.map((r, i) => (
                <li key={r._id}>
                  {(i === 0 || filteredRubrics[i - 1].course !== r.course) && (
                    <div className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <i className="fa-solid fa-folder-open mr-1" />
                      {courseLabel(r.course)}
                    </div>
                  )}
                  <button type="button" onClick={() => selectRubric(r)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedId === r._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="font-semibold text-sm text-gray-800 line-clamp-2">{r.taskTitle || r.title || 'Nouvelle Évaluation'}</div>
                    <div className="text-xs text-gray-500 flex justify-between mt-1 items-center">
                      <span className="truncate pr-2" title={r.title}>{r.title} (v{r.version})</span>
                      <div className="flex items-center gap-2">
                        {importedHere(r._id) && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700" title={(r.groups || []).join(", ") || "Cette session"}>
                            Cette session
                          </span>
                        )}
                        {r.isActive ? (
                          <span className="text-green-500 font-medium flex-shrink-0">Active</span>
                        ) : (
                          <span className="text-gray-400 font-medium flex-shrink-0">Inactive</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {filteredRubrics.length === 0 && <li className="p-4 text-sm text-gray-500 text-center">Aucune évaluation pour ce filtre.</li>}
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: Editor */}
        <div className="lg:col-span-3 space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm whitespace-pre-line text-emerald-700 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200"><i className="fa-solid fa-check mr-2"></i>{success}</div>}

          {!showEditor && (
            <div className="ui-card ui-card-body hidden lg:block">
              <p className="ui-info text-sm text-gray-600">Choisis une évaluation dans la liste pour la modifier, ou clique sur « Nouvelle » pour en créer une.</p>
            </div>
          )}
          {showEditor && (
            <>
              <div className="ui-card ui-form" style={{ "--ui-accent": selectedId ? "#2563eb" : "#059669" }}>
                <div className="ui-card-head">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="ui-mode">{selectedId ? "Modification" : "Nouvelle évaluation"}</span>
                    <h2 className="min-w-0 truncate">{selectedId ? taskTitle || title : "Cours, nom, session, puis critères"}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${hasUnsavedChanges || sessionDirty ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                      <i className={`fa-solid ${hasUnsavedChanges || sessionDirty ? "fa-circle-exclamation" : "fa-check"}`} aria-hidden />
                      {hasUnsavedChanges || sessionDirty ? "Non enregistré" : "Enregistré"}
                    </span>
                    <button type="button" onClick={save} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700">
                      <i className="fa-solid fa-save mr-1" aria-hidden /> Enregistrer
                    </button>
                    <button type="button" onClick={closeEditor} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                      <i className="fa-solid fa-arrow-left mr-1" aria-hidden /> Mes évaluations
                    </button>
                  </div>
                </div>

                <div className="ui-card-body space-y-6">
                  {/* 1. Cours */}
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">1</span> Cours</h3>
                    <CoursePicker courses={courses.filter((c) => !c.archivedAt)} value={courseId} onChange={changeCourse} />
                    {courseNotice && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><i className="fa-solid fa-link-slash mr-1" aria-hidden />{courseNotice}</p>}
                  </section>

                  {/* 2. Identification */}
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">2</span> Évaluation</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_6rem]">
                      <label>
                        <span className="ui-label">Nom de l&apos;évaluation</span>
                        <input type="text" placeholder="Ex : Examen 1, TP 2…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                      </label>
                      <label>
                        <span className="ui-label">Version</span>
                        <input type="number" min={1} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" value={version} onChange={(e) => setVersion(Number(e.target.value))} />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-gray-200">
                      <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active (proposée par défaut aux sessions)</label>
                      <label className="inline-flex items-center gap-2"><input type="checkbox" checked={linkCompetencies} onChange={(e) => setLinkCompetencies(e.target.checked)} /> Lier aux éléments de compétence</label>
                    </div>
                  </section>

                  {/* 3. Session en cours */}
                  <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-indigo-500/25 dark:bg-indigo-950/30">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">3</span> Session en cours{active ? ` : ${active.name}` : ""}</h3>
                    {!active ? (
                      <p className="text-xs text-gray-600">Aucune session en cours : l&apos;évaluation sera seulement rangée dans son cours.</p>
                    ) : !courseId ? (
                      <p className="text-xs text-gray-600">Choisis d&apos;abord le cours.</p>
                    ) : (
                      <div className="space-y-3">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                          <input type="checkbox" checked={useInSession} onChange={(e) => { setUseInSession(e.target.checked); setSessionDirty(true); }} />
                          À corriger cette session
                        </label>
                        <p className="text-xs text-gray-500">
                          <i className="fa-solid fa-link mr-1" aria-hidden />
                          {useInSession ? `${courseLabel(courseId)} · ${sessionEntry ? "cochée dans la session" : "le cours sera ajouté à la session"}. Les groupes qui suivent le cours se choisissent dans « Ma session ».` : "Non cochée : elle n'apparaît pas dans Corriger."}
                          {!useInSession && sessionEntry?.rubrics.find((r) => String(r._id) === String(selectedId))?.correctedCount > 0 && ` Attention : ${sessionEntry.rubrics.find((r) => String(r._id) === String(selectedId)).correctedCount} copie(s) déjà corrigée(s) (conservées).`}
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              </div>

          <div className="ui-card ui-card-body relative">
            <div className="flex justify-between items-center mb-6">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">4</span> Critères</h3>
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setShowAIModal(true)} className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50" title="Gabarit à donner à une IA pour générer les critères">
                      <i className="fa-solid fa-robot mr-1.5" aria-hidden />Avec une IA
                    </button>
                    <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total : {totalPoints} pts</span>
                    <button type="button" onClick={addCriterion} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm">
                        <i className="fa-solid fa-plus"></i> Ajouter Critère
                    </button>
                </div>
            </div>

            {selectedCourse && (selectedCourse.competencies || []).length > 0 && (() => {
              const cov = alignCriteriaToCourse(criteria, selectedCourse.competencies);
              const ok = cov.unlinked === 0 && cov.missing.length === 0;
              return (
                <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  <p className="font-semibold">
                    <i className={`fa-solid ${ok ? "fa-circle-check" : "fa-circle-exclamation"} mr-1.5`} aria-hidden />
                    Compétences de « {selectedCourse.title} » : {(selectedCourse.competencies || []).length - cov.missing.length} sur {(selectedCourse.competencies || []).length} couvertes
                    {cov.unlinked ? ` · ${cov.unlinked} critère(s) non rattaché(s)` : ""}
                  </p>
                  {cov.missing.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span>Sans critère : {cov.missing.map((m) => m.title).join(" ; ")}</span>
                      <button type="button" onClick={addMissingCompetencies} className="rounded-md bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700">Ajouter les compétences manquantes</button>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-6">
              {criteria.map((c, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                  <button type="button" onClick={() => removeCriterion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition"><i className="fa-solid fa-trash"></i></button>
                  
                  <div className="mb-4 space-y-4 pr-8">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
                      <div className="min-w-0 md:col-span-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titre du critère</label>
                        <input
                          type="text"
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded text-sm outline-none"
                          value={c.title}
                          onChange={(e) => updateCriterion(idx, "title", e.target.value)}
                        />
                      </div>
                      <div className="min-w-0 md:col-span-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Points (Poids)</label>
                        <input
                          type="number"
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded text-sm outline-none"
                          value={c.weight}
                          onChange={(e) => updateCriterion(idx, "weight", Number(e.target.value))}
                        />
                      </div>
                      <div className="min-w-0 md:col-span-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Couleur UI</label>
                        <select
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded text-sm outline-none"
                          value={c.color}
                          onChange={(e) => updateCriterion(idx, "color", e.target.value)}
                        >
                          <option value="border-blue-500">Bleu</option>
                          <option value="border-green-500">Vert</option>
                          <option value="border-purple-500">Violet</option>
                          <option value="border-orange-500">Orange</option>
                          <option value="border-red-500">Rouge</option>
                          <option value="border-gray-500">Gris</option>
                        </select>
                      </div>
                    </div>
                    {linkCompetencies && (
                      <div className="min-w-0">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Élément de compétence <span className="font-normal normal-case text-gray-400">(optionnel)</span>
                          {selectedCourse && (selectedCourse.competencies || []).length > 0 && (
                            c.competencyId
                              ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-emerald-700">Lié au cours</span>
                              : <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-800">Non lié au cours</span>
                          )}
                        </label>
                        <input
                          type="text"
                          className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded text-sm outline-none"
                          placeholder="Ex. résoudre un problème algorithmique (référence au plan de cours)"
                          value={c.competencyElement || ""}
                          onChange={(e) => updateCriterion(idx, "competencyElement", e.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Niveaux de performance (Descripteurs)</label>
                        <button type="button" onClick={() => addLevel(idx)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter un niveau</button>
                    </div>
                    {c.levels?.map((l, lIdx) => (
                      <div key={lIdx} className="flex flex-wrap gap-2 items-start group">
                         <div className="w-full sm:w-32 sm:flex-shrink-0">
                           <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white font-semibold" value={l.label} onChange={e => updateLevel(idx, lIdx, 'label', e.target.value)} />
                         </div>
                         <div className="w-[calc(50%-0.25rem)] sm:w-20 sm:flex-shrink-0 relative" title="Pourcentage (0 à 1) à partir duquel ce niveau s'applique">
                           <input type="number" step="0.05" min="0" max="1" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" value={l.minPct ?? l.maxPct} onChange={e => updateLevel(idx, lIdx, 'minPct', Number(e.target.value))} />
                           <span className="absolute right-2 top-1.5 text-xs text-gray-400">dès</span>
                         </div>
                         <div className="w-[calc(50%-0.25rem)] sm:w-20 sm:flex-shrink-0 relative" title="Note proposée (0 à 1) quand on clique sur ce niveau à la correction">
                           <input type="number" step="0.05" min="0" max="1" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" value={l.maxPct} onChange={e => updateLevel(idx, lIdx, 'maxPct', Number(e.target.value))} />
                           <span className="absolute right-2 top-1.5 text-xs text-gray-400">note</span>
                         </div>
                         <div className="w-full sm:w-auto sm:min-w-0 sm:flex-1 flex gap-2 items-start">
                           <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" rows="2" value={l.desc} onChange={e => updateLevel(idx, lIdx, 'desc', e.target.value)}></textarea>
                           <button type="button" onClick={() => removeLevel(idx, lIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-1" title="Supprimer ce niveau"><i className="fa-solid fa-times"></i></button>
                         </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 mt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase">Tâches : éléments précis à évaluer, avec points (optionnel)</label>
                        <button type="button" onClick={() => addSC(idx)} className="text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter une tâche</button>
                    </div>
                    {c.subCriteria?.map((sc, scIdx) => (
                      <div key={scIdx} className="space-y-1 group bg-purple-50/30 p-2 rounded-lg border border-purple-100">
                         <div className="flex gap-2 items-start">
                           <div className="flex-grow">
                             <input type="text" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white font-semibold" placeholder="Ex : Déploiement d'OPNsense et configuration adéquate des interfaces" value={sc.label} onChange={e => updateSC(idx, scIdx, 'label', e.target.value)} />
                           </div>
                           <div className="w-20 flex-shrink-0 relative">
                             <input type="number" step="0.5" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white" value={sc.pts} onChange={e => updateSC(idx, scIdx, 'pts', Number(e.target.value))} />
                             <span className="absolute right-2 top-1.5 text-xs text-gray-400 font-bold">pts</span>
                           </div>
                           <div className="flex-shrink-0">
                             <button type="button" onClick={() => removeSC(idx, scIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-2" title="Supprimer cette tâche"><i className="fa-solid fa-times"></i></button>
                           </div>
                         </div>
                         <textarea className="w-full px-2 py-1 border border-purple-100 focus:border-purple-300 rounded text-xs outline-none bg-white text-gray-600" rows="1" placeholder="⚠ Rétroaction (optionnel) — affichée à l'élève quand la tâche n'obtient pas tous ses points" value={sc.feedback || ''} onChange={e => updateSC(idx, scIdx, 'feedback', e.target.value)}></textarea>
                      </div>
                    ))}
                    {c.subCriteria?.length > 0 && (() => {
                      const total = tasksTotal(c);
                      const ok = Math.abs(total - (Number(c.weight) || 0)) < 0.01;
                      return (
                        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                          <span>
                            <i className={`fa-solid mr-1.5 ${ok ? "fa-circle-check" : "fa-triangle-exclamation"}`}></i>
                            Total des tâches : <strong>{total}</strong> / {c.weight} pts
                            {!ok && " — les points des tâches doivent égaler la pondération du critère."}
                          </span>
                          {!ok && (
                            <span className="flex gap-1.5">
                              <button type="button" onClick={() => updateCriterion(idx, "weight", total)} className="rounded border border-red-300 bg-white px-2 py-0.5 font-semibold hover:bg-red-100">Pondération = {total}</button>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              ))}
            </div>

            {/* Feedback Messages Editor */}
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase"><i className="fa-solid fa-comment-dots mr-2 text-blue-500"></i>Rétroaction Finale (PDF)</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Ces messages apparaîtront à la fin du document PDF selon le pourcentage obtenu par l'étudiant.</p>
              <div className="space-y-2">
                {feedbackMessages.map((fm, fmIdx) => {
                  const bgColor = fm.maxPct <= 40 ? 'border-l-red-400 bg-red-50/30' : fm.maxPct <= 60 ? 'border-l-orange-400 bg-orange-50/30' : fm.maxPct <= 80 ? 'border-l-yellow-400 bg-yellow-50/30' : fm.maxPct <= 90 ? 'border-l-blue-400 bg-blue-50/30' : 'border-l-green-400 bg-green-50/30';
                  return (
                    <div key={fmIdx} className={`flex flex-wrap gap-2 items-start p-2 rounded-lg border-l-4 ${bgColor}`}>
                      <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.minPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], minPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.maxPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], maxPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400 font-bold">%</span>
                      </div>
                      <input type="text" className="w-full sm:w-auto sm:min-w-0 sm:flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs outline-none" value={fm.message} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], message: e.target.value}; setFeedbackMessages(n); }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 flex justify-between items-center">
                {selectedId ? (
                    confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-600">Confirmer ?</span>
                        <button type="button" onClick={removeRubric} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            Oui, supprimer
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all">
                            Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setDuplicating({ title: `${title} (copie)`, course: courseId, replaceInGroups: false })} className="text-blue-600 hover:text-blue-800 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            <i className="fa-solid fa-copy"></i> Dupliquer
                        </button>
                        <button type="button" onClick={archiveRubric} className="text-amber-700 hover:text-amber-900 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            <i className="fa-solid fa-box-archive"></i> Archiver
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-500 hover:text-red-700 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                            <i className="fa-solid fa-trash"></i> Supprimer cette Évaluation
                        </button>
                      </div>
                    )
                ) : (
                    <div></div>
                )}
                <button type="button" onClick={save} className="bg-gray-900 hover:bg-black dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold py-3 px-8 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500/60">
                    <i className="fa-solid fa-save"></i> Enregistrer cette Évaluation
                </button>
            </div>
            
          </div>
            </>
          )}
        </div>
      </main>

      {duplicating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">Dupliquer l'évaluation</h3>
            <p className="text-xs text-gray-500">
              Pour modifier une évaluation sans toucher à l&apos;originale. La copie repart en version 1, sans corrections.
            </p>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={duplicating.title} onChange={(e) => setDuplicating({ ...duplicating, title: e.target.value })} />
            <label className="block text-xs font-medium text-gray-600">
              Cours de la copie
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={duplicating.course}
                onChange={(e) => setDuplicating({ ...duplicating, course: e.target.value })}
              >
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.code ? `${c.code} · ` : ""}{c.title}</option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={duplicating.replaceInGroups}
                onChange={(e) => setDuplicating({ ...duplicating, replaceInGroups: e.target.checked })}
              />
              <span>Remplacer l&apos;originale par la copie dans mes groupes de la session en cours</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDuplicating(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold">Annuler</button>
              <button
                type="button"
                onClick={async () => {
                  const d = duplicating;
                  try {
                    const copy = await api.copyRubric(selectedId, { title: d.title, courseId: d.course, replaceInGroups: d.replaceInGroups });
                    setDuplicating(null);
                    await refresh();
                    selectRubric(copy);
                    setSuccess("Évaluation dupliquée (version 1, sans corrections). L'originale est inchangée.");
                  } catch (e) {
                    setError(String(e.message || e));
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Dupliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-bold">Importer une évaluation d&apos;un autre cours</h3>
            <p className="text-xs text-gray-500">L'évaluation est copiée dans le cours choisi (version 1, sans corrections). L&apos;originale reste inchangée.</p>
            <label className="block text-xs font-medium text-gray-600">
              Évaluation à importer
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={importing.source}
                onChange={(e) => setImporting({ ...importing, source: e.target.value })}
              >
                <option value="">Choisir…</option>
                {rubrics
                  .filter((r) => r.course !== importing.target)
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      {courseLabel(r.course)} — {r.taskTitle || r.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Dans le cours
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={importing.target}
                onChange={(e) => setImporting({ ...importing, target: e.target.value, source: "" })}
              >
                <option value="">Choisir…</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.code ? `${c.code} · ` : ""}{c.title}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImporting(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold">Annuler</button>
              <button
                type="button"
                disabled={!importing.source || !importing.target}
                onClick={async () => {
                  try {
                    const copy = await api.copyRubric(importing.source, { courseId: importing.target });
                    setImporting(null);
                    await refresh();
                    selectRubric(copy);
                    setSuccess("Évaluation importée dans le cours.");
                  } catch (e) {
                    setError(String(e.message || e));
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI TEMPLATE MODAL */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-3" onClick={(e) => e.target === e.currentTarget && setShowAIModal(false)}>
          <div className="ai-modal-shell flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-2xl">
            <div className="ai-modal-header flex flex-shrink-0 items-start justify-between gap-2 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50/80 px-4 py-3">
              <div className="min-w-0 pr-1">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><i className="fa-solid fa-robot text-indigo-600"></i> Configurateur de gabarit IA</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">Votre IA construit l'évaluation ; vous lui fournissez le contenu de votre cours.</p>
              </div>
              <button type="button" onClick={() => setShowAIModal(false)} className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:bg-white/80 hover:text-gray-700" aria-label="Fermer"><i className="fa-solid fa-xmark text-base"></i></button>
            </div>

            <div className="ai-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">

              {/* Étapes */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  ["1", "Copiez le gabarit", "Avec le bouton en bas de cette fenêtre."],
                  ["2", "Donnez-le à votre IA", "Collez-le dans ChatGPT, Claude, Gemini… avec les éléments ci-dessous."],
                  ["3", "Importez la réponse", "Collez le JSON obtenu avec « Importer un JSON collé »."],
                ].map(([n, title, text]) => (
                  <div key={n} className="rounded-lg border border-gray-200 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-bold text-gray-800"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">{n}</span>{title}</p>
                    <p className="mt-1 text-[11px] text-gray-600 leading-snug">{text}</p>
                  </div>
                ))}
              </section>

              {/* Cours : compétences ajoutées automatiquement au gabarit */}
              <section className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800"><i className="fa-solid fa-book-open mr-1 text-emerald-600 text-[11px]"></i> Cours du gabarit</label>
                <select value={courseId} onChange={(e) => changeCourse(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-400">
                  <option value="">— Aucun cours (je fournirai les compétences à l&apos;IA) —</option>
                  {courses.filter((c) => !c.archivedAt).map((c) => (
                    <option key={c._id} value={c._id}>{c.code ? `${c.code} · ` : ""}{c.title} ({(c.competencies || []).length} compétence(s))</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">C&apos;est le cours de l&apos;évaluation en cours (étape 1) : le gabarit et l&apos;import restent toujours d&apos;accord.</p>
                {selectedCourse && selectedCourseCompetencies.length > 0 && (
                  <ul className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-950 space-y-0.5">
                    {selectedCourseCompetencies.map((comp, i) => (
                      <li key={i}><span className="font-semibold">{i + 1}.</span> {comp.title}</li>
                    ))}
                  </ul>
                )}
                {selectedCourse && selectedCourseCompetencies.length === 0 && (
                  <p className="text-[11px] text-amber-800">Ce cours n&apos;a pas encore de compétences. <Link to="/ressources/cours" className="font-semibold underline">Ajoutez-les</Link> pour qu&apos;elles soient incluses, sinon fournissez-les à l&apos;IA.</p>
                )}
                {!selectedCourse && (
                  <p className="text-[11px] text-gray-500">
                    {courses.length === 0 ? "Vous n'avez pas encore de cours. " : ""}
                    <Link to="/ressources/cours" className="font-semibold text-emerald-700 underline">Entrez une fois les compétences de votre cours</Link> : elles seront ajoutées automatiquement au gabarit.
                  </p>
                )}
              </section>

              {/* Ce qu'il faut fournir */}
              <section className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                <p className="text-xs font-bold text-amber-950"><i className="fa-solid fa-paperclip mr-1.5"></i>À fournir à l&apos;IA en plus du gabarit</p>
                <ul className="mt-1.5 space-y-1.5 text-[12px] text-amber-950/90 leading-snug">
                  {selectedCourseCompetencies.length > 0 ? (
                    <li><i className="fa-solid fa-circle-check mr-1.5 text-emerald-600"></i><strong>Les {selectedCourseCompetencies.length} compétences du cours</strong> sont déjà dans le gabarit : rien à ajouter.</li>
                  ) : (
                    <li><i className="fa-solid fa-circle-check mr-1.5 text-amber-600"></i><strong>Vos critères de performance</strong> (ou éléments de compétence) du plan de cours, copiés tels quels. <span className="font-semibold">Obligatoire.</span></li>
                  )}
                  <li><i className="fa-solid fa-circle-check mr-1.5 text-amber-600"></i><strong>Votre examen ou l&apos;énoncé du travail</strong>, avec les points de chaque question. <span className="font-semibold">Obligatoire.</span></li>
                  <li><i className="fa-regular fa-circle mr-1.5 text-amber-600"></i>Un corrigé ou un barème, si vous en avez un. <span className="text-amber-800">Facultatif.</span></li>
                </ul>
                <p className="mt-2 border-t border-amber-200/80 pt-2 text-[11px] text-amber-900 leading-snug">
                  L&apos;IA garde vos critères tels quels, range chaque question dans le critère qu&apos;elle permet de juger (une <em>tâche</em>), répartit les points, rédige les niveaux de performance et vous signale ce qu&apos;elle n&apos;a pas pu trancher.
                </p>
              </section>

              {/* Options */}
              <section className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Niveaux de performance</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[["3", "3 niveaux"], ["4", "4 niveaux"], ["5", "5 niveaux"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setAiConfig({ ...aiConfig, niveaux: v })} className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${aiConfig.niveaux === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{l}</button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 leading-snug">{LEVEL_SCALES[aiConfig.niveaux].map((lvl) => `${lvl.label} (dès ${Math.round(lvl.minPct * 100)} %)`).join(" · ")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Langue du gabarit</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[["fr", "Français"], ["en", "English"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setAiConfig({ ...aiConfig, langue: v })} className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${aiConfig.langue === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {[
                  ["pointsPartiels", "Points partiels par tâche", "Le correcteur peut donner 0, la moitié, le maximum ou une valeur précise à chaque tâche."],
                  ["inclureFeedbackGlobal", "Messages de rétroaction globale", "5 messages personnalisés selon la note finale de l'élève (tutoiement)."],
                ].map(([key, label, hint]) => (
                  <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">{label}</p>
                      <p className="text-[11px] text-gray-500 leading-snug">{hint}</p>
                    </div>
                    <button type="button" aria-pressed={aiConfig[key]} onClick={() => setAiConfig({ ...aiConfig, [key]: !aiConfig[key] })} className={`relative mt-0.5 inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig[key] ? "bg-indigo-600" : "bg-gray-300"}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig[key] ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                ))}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800"><i className="fa-solid fa-wand-magic-sparkles mr-1 text-indigo-500 text-[11px]"></i> Consignes particulières pour l&apos;IA (facultatif)</label>
                  <textarea rows={2} placeholder="Ex : Les questions 1 à 5 portent sur le critère 1. Insister sur la conformité aux consignes de remise." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-300 resize-none" value={aiConfig.instructionsIa} onChange={(e) => setAiConfig({ ...aiConfig, instructionsIa: e.target.value })} />
                </div>
              </section>
            </div>

            <div className="ai-modal-footer flex flex-shrink-0 flex-col gap-2 border-t border-gray-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between rounded-b-xl">
              <p className="min-w-0 flex-1 text-[10px] text-gray-500 leading-snug order-2 sm:order-1">
                <i className="fa-solid fa-circle-info mr-0.5 text-gray-400"></i>
                {aiConfig.niveaux} niveaux{aiConfig.pointsPartiels ? " · points partiels" : " · tout ou rien"}{aiConfig.inclureFeedbackGlobal ? " · 5 rétroactions" : ""}
              </p>
              <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 order-1 sm:order-2">
                <button type="button" onClick={() => setShowAIModal(false)} className="whitespace-nowrap px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition">Annuler</button>
                <button type="button" onClick={copyAITemplateToClipboard} className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 ${aiCopySuccess ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  <i className={`fa-solid text-[11px] ${aiCopySuccess ? "fa-check" : "fa-copy"}`}></i>
                  {aiCopySuccess ? "Copié !" : "Copier le gabarit"}
                </button>
                <button type="button" onClick={downloadAITemplate} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">
                  <i className="fa-solid fa-download text-[11px]"></i> Télécharger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPasteJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setShowPasteJsonModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><i className="fa-solid fa-paste text-teal-600"></i> Importer un JSON collé</h2>
                <p className="text-xs text-gray-500 mt-0.5">Collez la réponse de votre IA : le JSON est repéré automatiquement.</p>
              </div>
              <button onClick={() => setShowPasteJsonModal(false)} className="text-gray-400 hover:text-gray-600 text-xl"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6">
              <textarea
                rows={12}
                value={pastedJsonText}
                onChange={(e) => setPastedJsonText(e.target.value)}
                placeholder="Collez ici la réponse de l'IA (le JSON, avec ou sans ```json)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowPasteJsonModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition">Annuler</button>
              <button onClick={importFromPastedJson} className="px-5 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow transition flex items-center gap-2">
                <i className="fa-solid fa-file-import"></i> Importer ce JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
