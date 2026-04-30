import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { distributePoints, normalizeImportedRubric } from "../lib/rubricTemplate";
import PageSectionTitle from "../components/PageSectionTitle";

const DEFAULT_CRITERION = {
  id: "cx",
  title: "Nouveau Critère",
  weight: 10,
  color: "border-blue-500",
  levels: [
    { label: "Insatisfaisant", maxPct: 0.5, desc: "Description..." },
    { label: "Bon", maxPct: 0.8, desc: "Description..." },
    { label: "Excellent", maxPct: 1, desc: "Description..." }
  ]
};

export default function AdminRubric() {
  const [rubrics, setRubrics] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // Form State
  const [title, setTitle] = useState("Nouvelle Grille");
  const [taskTitle, setTaskTitle] = useState("Tâche Finale");
  const [version, setVersion] = useState(1);
  const [groups, setGroups] = useState([]);
  const [showGroupsDropdown, setShowGroupsDropdown] = useState(false);
  const [criteria, setCriteria] = useState([{ ...DEFAULT_CRITERION, id: "c1" }]);
  const [isActive, setIsActive] = useState(true);
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
  const [showAIAdvanced, setShowAIAdvanced] = useState(false);
  const [aiCopySuccess, setAiCopySuccess] = useState(false);
  const [showPasteJsonModal, setShowPasteJsonModal] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState("");
  const [aiConfig, setAiConfig] = useState({
    langue: "fr",
    niveaux: "3",
    inclureSousCriteres: true,
    sousCritereFeedback: true,
    sousCritereFeedbackStyle: "court",
    inclureFeedbackGlobal: true,
    tonFeedback: "encourageant",
    palette: "arc-en-ciel",
    idsSemantics: false,
    inclureExemples: true,
    instructionsIa: "",
    niveauEtudiants: "collegial",
    critereParQuestion: true,
    nbQuestions: "4",
    nbCriteres: "4",
  });

  async function refresh() {
    try {
      const [data, dashboard] = await Promise.all([
        api.listRubrics(),
        api.getStudentGroupDashboard(),
      ]);
      setRubrics(data);
      setGroupOptions((dashboard || []).map((x) => x.group).filter(Boolean));
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function buildSnapshot(next = {}) {
    const snap = {
      selectedId: next.selectedId ?? selectedId ?? null,
      title: next.title ?? title,
      taskTitle: next.taskTitle ?? taskTitle,
      version: next.version ?? version,
      groups: next.groups ?? groups,
      isActive: next.isActive ?? isActive,
      criteria: next.criteria ?? criteria,
      feedbackMessages: next.feedbackMessages ?? feedbackMessages,
    };
    return JSON.stringify(snap);
  }

  const hasUnsavedChanges = useMemo(
    () => buildSnapshot() !== savedSnapshot,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, title, taskTitle, version, groups, isActive, criteria, feedbackMessages, savedSnapshot]
  );

  useEffect(() => {
    if (savedSnapshot) return;
    setSavedSnapshot(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSnapshot]);

  function selectRubric(r) {
    setSelectedId(r._id);
    setTitle(r.title || "");
    setTaskTitle(r.taskTitle || "");
    setVersion((r.version || 1) + 1); // Auto increment version for new save
    setGroups(Array.isArray(r.groups) && r.groups.length ? r.groups : (r.group ? [r.group] : []));
    setCriteria(r.criteria || []);
    setIsActive(r.isActive !== false);
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
        criteria: r.criteria || [],
        feedbackMessages: r.feedbackMessages && r.feedbackMessages.length > 0 ? r.feedbackMessages : DEFAULT_FEEDBACK,
      })
    );
  }

  function startNew() {
    setSelectedId(null);
    setTitle("Nouvelle Grille");
    setTaskTitle("Tâche");
    setVersion(1);
    setGroups([]);
    setCriteria([{ ...DEFAULT_CRITERION, id: "c1" }]);
    setIsActive(true);
    setFeedbackMessages(DEFAULT_FEEDBACK);
    setError("");
    setSuccess("");
    setConfirmDelete(false);
    setSavedSnapshot(
      buildSnapshot({
        selectedId: null,
        title: "Nouvelle Grille",
        taskTitle: "Tâche",
        version: 1,
        groups: [],
        isActive: true,
        criteria: [{ ...DEFAULT_CRITERION, id: "c1" }],
        feedbackMessages: DEFAULT_FEEDBACK,
      })
    );
  }

  async function save() {
    setError("");
    setSuccess("");
    try {
      if (selectedId) {
        await api.updateRubric(selectedId, { title, taskTitle, version, group: groups[0] || "", groups, criteria, isActive, feedbackMessages });
        setSuccess("Grille modifiée avec succès !");
      } else {
        const newRubric = await api.createRubric({ title, taskTitle, version, group: groups[0] || "", groups, criteria, isActive, feedbackMessages });
        setSelectedId(newRubric._id);
        setSuccess("Nouvelle grille créée avec succès !");
      }
      setSavedSnapshot(buildSnapshot());
      await refresh();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function removeRubric() {
    if (!selectedId) return;
    try {
      await api.deleteRubric(selectedId);
      startNew();
      await refresh();
      setSuccess("Grille supprimée avec succès !");
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
    newLevels.push({ label: "Nouveau", maxPct: 1, desc: "" });
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
    newSC.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), label: 'Nouveau point technique', pts: 1 });
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
    const data = { title, taskTitle, version, group: groups[0] || "", groups, criteria, isActive, feedbackMessages };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Grille_${(taskTitle || title || 'sans_titre').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildAITemplate() {
    const cfg = aiConfig;
    const LABELS = {
      fr: {
        title: "Nom du cours ou du sujet principal",
        taskTitle: "Titre de la tâche, du laboratoire ou de l'examen",
        criterionName: "Question",
        subLabel: "Élément observable à corriger",
        subFeedback: "Expliquez précisément quoi corriger si cet élément n'est pas réussi.",
        feedbackMsg: "Message de rétroaction affiché à l'élève pour cette tranche de score.",
      },
      en: {
        title: "Course or main topic",
        taskTitle: "Task, lab, or exam title",
        criterionName: "Question",
        subLabel: "Observable grading item",
        subFeedback: "Explain exactly what to fix if this item is not completed.",
        feedbackMsg: "Feedback displayed to the student for this score range.",
      },
    };
    const L = LABELS[cfg.langue] || LABELS.fr;

    const PALETTES = { "arc-en-ciel": ["border-blue-500","border-green-500","border-purple-500","border-orange-500","border-red-500","border-gray-500"], "mono": ["border-blue-500"], "chaleur": ["border-red-500","border-orange-500","border-yellow-500"], "cool": ["border-blue-500","border-indigo-500","border-purple-500","border-cyan-500"] };
    const palette = PALETTES[cfg.palette] || PALETTES["arc-en-ciel"];

    const NIVEAUX = {
      "2": [{ label: "Échec / Non réussi", maxPct: 0, desc: "Description de ce niveau d'échec" }, { label: "Réussite / Complet", maxPct: 1, desc: "Description de la réussite complète" }],
      "3": [{ label: "Insuffisant", maxPct: 0, desc: "Absent ou non fonctionnel" }, { label: "Acceptable", maxPct: 0.65, desc: "Présent mais incomplet ou avec erreurs" }, { label: "Excellent", maxPct: 1, desc: "Complet, fonctionnel et conforme aux bonnes pratiques" }],
      "4": [{ label: "Débutant", maxPct: 0, desc: "Tentative présente mais non fonctionnelle" }, { label: "Intermédiaire", maxPct: 0.5, desc: "Partiellement réalisé avec des erreurs notables" }, { label: "Avancé", maxPct: 0.8, desc: "Bien réalisé avec quelques lacunes mineures" }, { label: "Expert", maxPct: 1, desc: "Parfaitement réalisé, bonnes pratiques respectées" }],
      "5": [{ label: "Non fonctionnel", maxPct: 0, desc: "Absent ou totalement incorrect" }, { label: "Débutant", maxPct: 0.35, desc: "Présent mais non fonctionnel, erreurs majeures" }, { label: "En développement", maxPct: 0.6, desc: "Partiellement fonctionnel, erreurs significatives" }, { label: "Compétent", maxPct: 0.8, desc: "Fonctionnel avec quelques imperfections" }, { label: "Maître", maxPct: 1, desc: "Parfait, sans erreur, bonnes pratiques appliquées" }],
    };
    const niveauxBase = NIVEAUX[cfg.niveaux] || NIVEAUX["3"];

    const TRANCHES_5 = [[0,60],[60,75],[75,85],[85,95],[95,100]];
    const tranches = TRANCHES_5;

    const TON = {
      encourageant: "Encourageant et motivant, tout en restant professionnel et respectueux — valorisez les efforts, 2-3 phrases chaleureuses",
      formel: "Formel et académique — ton neutre, précis, professionnel, 1-2 phrases factuelles",
      direct: "Direct et concis — 1 phrase claire, professionnelle et respectueuse, sans sarcasme, sans familiarité, sans jugement",
      verbeux: "Très détaillé — 4-6 phrases, conseils concrets et actionnables, vocabulaire professionnel et respectueux",
    };

    const makeId = (prefix, n) => cfg.idsSemantics ? `${prefix}-[MOT-CLE-${n}]` : `${prefix}${n}`;

    const autoOnePerQuestion = cfg.critereParQuestion;
    const requestedManual = parseInt(cfg.nbCriteres, 10) || 4;
    const nbCriteres = autoOnePerQuestion
      ? 1
      : Math.max(1, Math.min(50, requestedManual));
    const weights = autoOnePerQuestion
      ? [0]
      : distributePoints(100, nbCriteres);

    const teacherNotes = String(cfg.instructionsIa || "").trim();
    const isEn = cfg.langue === "en";
    const instructionsForModel = {
      criteriaCount: autoOnePerQuestion
        ? (isEn
          ? "Create exactly as many objects in `criteria` as there are graded questions (or distinct scored parts) in the exam. The template below shows only ONE example row — repeat the same structure for every question."
          : "Créer exactement autant d'objets dans `criteria` qu'il y a de questions (ou de parties notées distinctes) dans l'énoncé. Ce gabarit ne montre qu'UNE ligne d'exemple — reproduire la même structure pour chaque question.")
        : (isEn
          ? `Create exactly ${nbCriteres} criteria in \`criteria\`, aligned with the exam whenever it makes sense.`
          : `Créer exactement ${nbCriteres} critères dans \`criteria\`, alignés sur l'énoncé lorsque c'est pertinent.`),
      pointsAndWeights: autoOnePerQuestion
        ? (isEn
          ? "Each `weight` MUST match the points assigned to that question in the exam. The sum of all `weights` MUST equal the exam total (not necessarily 100). The value 0 here is only a placeholder in the single example row."
          : "Chaque `weight` DOIT reprendre les points de la question correspondante dans l'énoncé. La somme des `weight` DOIT égaler le total de l'examen (pas forcément 100). La valeur 0 sur l'exemple unique n'est qu'un substitut.")
        : (isEn
          ? "Replace every `weight` with the real points from the exam. The template weights are an illustrative split out of 100 — discard them if they disagree with the exam. The sum of `weights` MUST equal the exam total."
          : "Remplacer chaque `weight` par les points réels de l'énoncé. Les pondérations ci-dessous sont une répartition fictive sur 100 pour l'aperçu : ne pas les garder si elles contredisent l'examen. La somme des `weight` doit égaler le total de l'examen."),
      ...(cfg.inclureSousCriteres
        ? {
            subCriteriaSum: isEn
              ? "If `subCriteria` are used, the sum of `pts` for each criterion must equal that criterion's `weight`."
              : "Si `subCriteria` est utilisé, la somme des `pts` doit égaler le `weight` du critère parent.",
          }
        : {}),
      ...(teacherNotes ? { teacherInstructions: teacherNotes } : {}),
    };

    const buildCriterion = (i) => {
      const weight = weights[i];
      const levels = niveauxBase.map(nv => ({
        label: nv.label,
        maxPct: nv.maxPct,
        desc: cfg.inclureExemples
          ? `${nv.desc}. Remplacer par un exemple concret et observable lié à cette question.`
          : `${nv.desc}.`,
      }));
      const criterion = {
        id: makeId("c", i + 1),
        title: `${L.criterionName} ${i + 1} - remplacer par l'intitule exact`,
        weight,
        color: palette[i % palette.length],
        levels,
      };
      if (cfg.inclureSousCriteres) {
        const fbStyle = cfg.sousCritereFeedbackStyle === "verbeux"
          ? `${L.subFeedback} Ajoutez 2 ou 3 conseils concrets et actionnables.`
          : L.subFeedback;
        const subPoints = distributePoints(weight, 3);
        criterion.subCriteria = [
          { id: makeId("sc", `${i+1}-1`), label: `${L.subLabel} 1`, pts: subPoints[0], ...(cfg.sousCritereFeedback ? { feedback: fbStyle } : {}) },
          { id: makeId("sc", `${i+1}-2`), label: `${L.subLabel} 2`, pts: subPoints[1], ...(cfg.sousCritereFeedback ? { feedback: fbStyle } : {}) },
          { id: makeId("sc", `${i+1}-3`), label: `${L.subLabel} 3`, pts: subPoints[2], ...(cfg.sousCritereFeedback ? { feedback: fbStyle } : {}) },
        ];
      }
      return criterion;
    };
    const criteriaExamples = Array.from({ length: nbCriteres }, (_, i) => buildCriterion(i));

    const feedbackMessages = cfg.inclureFeedbackGlobal ? tranches.map(([min, max]) => ({
      minPct: min,
      maxPct: max,
      message: `[TON: ${TON[cfg.tonFeedback]}] — Niveau ${cfg.niveauEtudiants}. Rédigez un message motivant/explicatif pour un étudiant ayant obtenu entre ${min}% et ${max}%. Le ton doit rester professionnel, constructif et respectueux en tout temps (aucune formulation familière, sarcastique ou dénigrante). ${L.feedbackMsg}`,
    })) : undefined;

    return {
      title: L.title,
      taskTitle: L.taskTitle,
      instructionsForModel,
      criteria: criteriaExamples,
      ...(feedbackMessages ? { feedbackMessages } : {}),
    };
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
    const result = normalizeImportedRubric(json, { defaultFeedbackMessages: DEFAULT_FEEDBACK });
    if (result.ok) {
      const imported = result.rubric;
      setTitle(imported.title);
      setTaskTitle(imported.taskTitle);
      setCriteria(imported.criteria);
      setVersion(1);
      setSelectedId(null);
      setFeedbackMessages(imported.feedbackMessages);
      setGroups(imported.groups);
      setSuccess(`Grille importée et normalisée : ${imported.criteria.length} critère(s), ${imported.criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0)} pts.`);
      setError("");
      setSavedSnapshot("");
      return true;
    }
    setError(result.error);
    return false;
  }

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
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
      const json = JSON.parse(pastedJsonText);
      const ok = applyImportedRubric(json);
      if (ok) {
        setShowPasteJsonModal(false);
        setPastedJsonText("");
      }
    } catch {
      setError("JSON invalide. Vérifiez la syntaxe avant d'importer.");
    }
  }

  const totalPoints = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-4">
          <PageSectionTitle
            icon="fa-sliders"
            iconBgClass="bg-slate-700"
            title="Administration des Grilles"
            subtitle="Configuration"
          />
        </div>
        
        {/* LEFT COLUMN: List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={startNew} className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-plus"></i> <span className="hidden xl:inline">Nouvelle</span>
            </button>
            <label className="bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center cursor-pointer text-sm" title="Importer depuis JSON">
                <i className="fa-solid fa-upload"></i>
                <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
            </label>
            <button type="button" onClick={() => setShowPasteJsonModal(true)} className="bg-white text-teal-600 border border-teal-200 hover:bg-teal-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center text-sm shadow-sm" title="Coller un JSON">
                <i className="fa-solid fa-paste"></i>
            </button>
            <button onClick={exportJSON} className="bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center text-sm shadow-sm" title="Exporter en JSON">
                <i className="fa-solid fa-download"></i>
            </button>
            <button onClick={() => setShowAIModal(true)} className="bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center text-sm shadow-sm" title="Configurer et télécharger un gabarit IA">
                <i className="fa-solid fa-robot"></i>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 border-b border-gray-100">Grilles Enregistrées</h3>
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {rubrics.map(r => (
                <li key={r._id}>
                  <button type="button" onClick={() => selectRubric(r)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedId === r._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="font-semibold text-sm text-gray-800 line-clamp-2">{r.taskTitle || r.title || 'Nouvelle Grille'}</div>
                    <div className="text-xs text-gray-500 flex justify-between mt-1 items-center">
                      <span className="truncate pr-2" title={r.title}>{r.title} (v{r.version})</span>
                      <div className="flex items-center gap-2">
                        {(Array.isArray(r.groups) && r.groups.length > 0) && (
                          <span className="text-slate-500 text-[11px] font-medium truncate max-w-[10rem]" title={r.groups.join(", ")}>
                            {r.groups.join(", ")}
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
              {rubrics.length === 0 && <li className="p-4 text-sm text-gray-500 text-center">Aucune grille.</li>}
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: Editor */}
        <div className="lg:col-span-3 space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-300/50 dark:bg-teal-950/45 dark:text-emerald-200"><i className="fa-solid fa-check mr-2"></i>{success}</div>}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-800">Paramètres Généraux</h2>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                    <i className="fa-solid fa-circle-exclamation" />
                    Modifications non enregistrées
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <i className="fa-solid fa-check" />
                    Tout est enregistré
                  </span>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={!hasUnsavedChanges}
                  className="bg-gray-900 hover:bg-black dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-slate-950 font-semibold py-2.5 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500/60"
                >
                  <i className="fa-solid fa-save"></i> Enregistrer
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du Cours</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du Travail (Tâche)</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version (Sera enregistrée comme nouvelle)</label>
                  <input type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={version} onChange={e => setVersion(Number(e.target.value))} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Groupes associés (optionnel, multiple)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowGroupsDropdown((v) => !v)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between"
                    >
                      <span className="truncate text-sm text-gray-800">
                        {groups.length ? groups.join(", ") : "Choisir un ou plusieurs groupes"}
                      </span>
                      <i className={`fa-solid ${showGroupsDropdown ? "fa-chevron-up" : "fa-chevron-down"} text-xs text-gray-500`} />
                    </button>
                    {showGroupsDropdown && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg p-1">
                        {groupOptions.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-gray-500">Aucun groupe disponible</div>
                        )}
                        {groupOptions.map((g) => {
                          const checked = groups.includes(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
                              }}
                              className="w-full px-2 py-1.5 text-left text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                            >
                              <i className={`fa-solid ${checked ? "fa-check-square text-blue-600" : "fa-square text-gray-300"}`} />
                              <span>{g}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Cliquez pour cocher/décocher plusieurs groupes.</p>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Grille active (visible dans Corriger)
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Éditeur de Critères</h2>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total : {totalPoints} pts</span>
                    <button type="button" onClick={addCriterion} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm">
                        <i className="fa-solid fa-plus"></i> Ajouter Critère
                    </button>
                </div>
            </div>

            <div className="space-y-6">
              {criteria.map((c, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                  <button type="button" onClick={() => removeCriterion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition"><i className="fa-solid fa-trash"></i></button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 pr-8">
                    <div className="col-span-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titre du critère</label>
                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.title} onChange={e => updateCriterion(idx, 'title', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Points (Poids)</label>
                      <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.weight} onChange={e => updateCriterion(idx, 'weight', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Couleur UI</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" value={c.color} onChange={e => updateCriterion(idx, 'color', e.target.value)}>
                        <option value="border-blue-500">Bleu</option>
                        <option value="border-green-500">Vert</option>
                        <option value="border-purple-500">Violet</option>
                        <option value="border-orange-500">Orange</option>
                        <option value="border-red-500">Rouge</option>
                        <option value="border-gray-500">Gris</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Niveaux de performance (Descripteurs)</label>
                        <button type="button" onClick={() => addLevel(idx)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter un niveau</button>
                    </div>
                    {c.levels?.map((l, lIdx) => (
                      <div key={lIdx} className="flex gap-2 items-start group">
                         <div className="w-32 flex-shrink-0">
                           <input type="text" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white font-semibold" value={l.label} onChange={e => updateLevel(idx, lIdx, 'label', e.target.value)} />
                         </div>
                         <div className="w-20 flex-shrink-0 relative">
                           <input type="number" step="0.1" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" value={l.maxPct} onChange={e => updateLevel(idx, lIdx, 'maxPct', Number(e.target.value))} />
                           <span className="absolute right-2 top-1.5 text-xs text-gray-400">max</span>
                         </div>
                         <div className="flex-grow flex gap-2 items-start">
                           <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs outline-none bg-white" rows="2" value={l.desc} onChange={e => updateLevel(idx, lIdx, 'desc', e.target.value)}></textarea>
                           <button type="button" onClick={() => removeLevel(idx, lIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-1" title="Supprimer ce niveau"><i className="fa-solid fa-times"></i></button>
                         </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 mt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase">Sous-critères : Cases à cocher (Optionnel)</label>
                        <button type="button" onClick={() => addSC(idx)} className="text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-1 rounded font-bold transition"><i className="fa-solid fa-plus"></i> Ajouter option</button>
                    </div>
                    {c.subCriteria?.map((sc, scIdx) => (
                      <div key={scIdx} className="space-y-1 group bg-purple-50/30 p-2 rounded-lg border border-purple-100">
                         <div className="flex gap-2 items-start">
                           <div className="flex-grow">
                             <input type="text" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white font-semibold" placeholder="Ex: L'enregistrement DNS est configuré" value={sc.label} onChange={e => updateSC(idx, scIdx, 'label', e.target.value)} />
                           </div>
                           <div className="w-20 flex-shrink-0 relative">
                             <input type="number" step="0.5" className="w-full px-2 py-1.5 border border-purple-200 focus:border-purple-400 rounded text-xs outline-none bg-white" value={sc.pts} onChange={e => updateSC(idx, scIdx, 'pts', Number(e.target.value))} />
                             <span className="absolute right-2 top-1.5 text-xs text-gray-400 font-bold">pts</span>
                           </div>
                           <div className="flex-shrink-0">
                             <button type="button" onClick={() => removeSC(idx, scIdx)} className="text-red-400 hover:text-red-600 opacity-20 group-hover:opacity-100 transition p-2" title="Supprimer ce sous-critère"><i className="fa-solid fa-times"></i></button>
                           </div>
                         </div>
                         <textarea className="w-full px-2 py-1 border border-purple-100 focus:border-purple-300 rounded text-xs outline-none bg-white text-gray-600" rows="1" placeholder="⚠ Feedback si non réussi (optionnel) — affiché quand cette case N'EST PAS cochée" value={sc.feedback || ''} onChange={e => updateSC(idx, scIdx, 'feedback', e.target.value)}></textarea>
                      </div>
                    ))}
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
                    <div key={fmIdx} className={`flex gap-2 items-start p-2 rounded-lg border-l-4 ${bgColor}`}>
                      <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.minPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], minPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="number" className="w-12 px-1 py-1 border border-gray-300 rounded text-xs outline-none text-center" value={fm.maxPct} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], maxPct: Number(e.target.value)}; setFeedbackMessages(n); }} />
                        <span className="text-xs text-gray-400 font-bold">%</span>
                      </div>
                      <input type="text" className="flex-grow px-2 py-1 border border-gray-200 rounded text-xs outline-none" value={fm.message} onChange={e => { const n = [...feedbackMessages]; n[fmIdx] = {...n[fmIdx], message: e.target.value}; setFeedbackMessages(n); }} />
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
                      <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-500 hover:text-red-700 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                          <i className="fa-solid fa-trash"></i> Supprimer cette Grille
                      </button>
                    )
                ) : (
                    <div></div>
                )}
                <button type="button" onClick={save} className="bg-gray-900 hover:bg-black dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold py-3 px-8 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500/60">
                    <i className="fa-solid fa-save"></i> Enregistrer cette Grille
                </button>
            </div>
            
          </div>
        </div>
      </main>

      {/* AI TEMPLATE MODAL */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setShowAIModal(false)}>
          <div className="ai-modal-shell bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="ai-modal-header flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><i className="fa-solid fa-robot text-purple-600"></i> Configurateur de Gabarit IA</h2>
                <p className="text-xs text-gray-500 mt-0.5">Personnalisez les options pour générer un gabarit JSON optimal</p>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-gray-600 text-xl"><i className="fa-solid fa-xmark"></i></button>
            </div>

            <div className="ai-modal-body p-6 space-y-6">

              {/* Instructions IA (lue par le modèle avec le gabarit) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2"><i className="fa-solid fa-wand-magic-sparkles mr-1 text-blue-500"></i> Instructions pour l&apos;IA</label>
                <textarea rows={3} placeholder="Ex: Viser la même découpe que l'énoncé officiel. Ton formel. Insister sur la conformité aux consignes de remise." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400 resize-none" value={aiConfig.instructionsIa} onChange={e => setAiConfig({...aiConfig, instructionsIa: e.target.value})} />
                <p className="text-[11px] text-gray-500 mt-1">Ces consignes sont incluses dans le JSON du gabarit (champ dédié) pour le modèle qui le complète.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Langue */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">🌐 Langue du gabarit</label>
                  <div className="flex gap-2">
                    {[["fr","🇫🇷 Français"],["en","🇬🇧 English"]].map(([v,l]) => (
                      <button key={v} onClick={() => setAiConfig({...aiConfig, langue: v})} className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${aiConfig.langue === v ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Niveau étudiants */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">🎓 Niveau des étudiants</label>
                  <div className="flex gap-2">
                    {[["secondaire","Secondaire"],["collegial","Collégial"],["universitaire","Universitaire"]].map(([v,l]) => (
                      <button key={v} onClick={() => setAiConfig({...aiConfig, niveauEtudiants: v})} className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${aiConfig.niveauEtudiants === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-800 flex items-center gap-2"><i className="fa-solid fa-sliders"></i> Mode avancé</p>
                  <p className="text-xs text-purple-700">Affiche les réglages détaillés liés à chaque section.</p>
                </div>
                <button onClick={() => setShowAIAdvanced(!showAIAdvanced)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAIAdvanced ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showAIAdvanced ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Niveaux */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">📊 Niveaux de performance</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[["2","2 — Échec/Réussite"],["3","3 — Standard"],["4","4 — Graduel"],["5","5 — Granulaire"]].map(([v,l]) => (
                      <button key={v} onClick={() => setAiConfig({...aiConfig, niveaux: v})} className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all text-left ${aiConfig.niveaux === v ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Nb critères */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">🔢 Nombre de questions / critères</label>
                  <div className="flex items-center justify-between mb-2 p-2 rounded-lg border border-orange-200 bg-orange-50">
                    <span className="text-xs font-medium text-orange-800">1 critère = 1 question</span>
                    <button onClick={() => setAiConfig({...aiConfig, critereParQuestion: !aiConfig.critereParQuestion})} className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${aiConfig.critereParQuestion ? 'bg-orange-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${aiConfig.critereParQuestion ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    disabled={aiConfig.critereParQuestion}
                    value={aiConfig.critereParQuestion ? aiConfig.nbQuestions : aiConfig.nbCriteres}
                    onChange={e => setAiConfig({
                      ...aiConfig,
                      ...(aiConfig.critereParQuestion
                        ? { nbQuestions: e.target.value }
                        : { nbCriteres: e.target.value })
                    })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 ${aiConfig.critereParQuestion ? "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed" : "border-gray-300 focus:ring-orange-400"}`}
                    placeholder={aiConfig.critereParQuestion ? "Désactivé — déduit de l'examen" : "Ex: 4 critères"}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    {aiConfig.critereParQuestion
                      ? "Mode automatique : le gabarit indique au modèle de créer un critère par question de l'énoncé. La valeur affichée ci-dessus n'est pas utilisée."
                      : "Mode personnalisé : définissez un nombre de critères ; le gabarit rappelle toutefois d'aligner les points sur l'énoncé."}
                  </p>
                </div>
              </div>

              {/* Sous-critères */}
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700">✅ Sous-critères (cases à cocher techniques)</label>
                  <button onClick={() => setAiConfig({...aiConfig, inclureSousCriteres: !aiConfig.inclureSousCriteres})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiConfig.inclureSousCriteres ? 'bg-purple-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiConfig.inclureSousCriteres ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {showAIAdvanced && aiConfig.inclureSousCriteres && (
                  <div className="space-y-2 pl-2 border-l-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Inclure un feedback par sous-critère non coché</span>
                      <button onClick={() => setAiConfig({...aiConfig, sousCritereFeedback: !aiConfig.sousCritereFeedback})} className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${aiConfig.sousCritereFeedback ? 'bg-purple-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${aiConfig.sousCritereFeedback ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {aiConfig.sousCritereFeedback && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Style du feedback :</p>
                        <div className="flex gap-2">
                          {[["court","Court (1 phrase)"],["verbeux","Détaillé (2-3 phrases)"]].map(([v,l]) => (
                            <button key={v} onClick={() => setAiConfig({...aiConfig, sousCritereFeedbackStyle: v})} className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border transition-all ${aiConfig.sousCritereFeedbackStyle === v ? 'bg-purple-100 text-purple-700 border-purple-400' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rétroaction globale */}
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700">💬 Rétroactions globales (feedbackMessages)</label>
                  <button onClick={() => setAiConfig({...aiConfig, inclureFeedbackGlobal: !aiConfig.inclureFeedbackGlobal})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiConfig.inclureFeedbackGlobal ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiConfig.inclureFeedbackGlobal ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {showAIAdvanced && aiConfig.inclureFeedbackGlobal && (
                  <div className="space-y-3 pl-2 border-l-2 border-blue-200">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nombre de tranches :</p>
                      <div className="py-1.5 px-2 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 inline-block">
                        5 tranches (fixe)
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Ton de la rétroaction :</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[["encourageant","😊 Encourageant"],["formel","📋 Formel"],["direct","⚡ Direct professionnel"],["verbeux","📝 Verbeux"]].map(([v,l]) => (
                          <button key={v} onClick={() => setAiConfig({...aiConfig, tonFeedback: v})} className={`py-1.5 px-2 rounded text-xs font-medium border transition-all ${aiConfig.tonFeedback === v ? 'bg-blue-100 text-blue-700 border-blue-400' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Tous les tons restent professionnels et respectueux, même en mode direct.</p>
                    </div>
                  </div>
                )}
              </div>

              {showAIAdvanced && (
                <>
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-2">⚙️ Options avancées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["inclureExemples","Exemples concrets dans les niveaux"],
                        ["idsSemantics","IDs sémantiques (ex: c-nat-1)"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                          <input type="checkbox" checked={aiConfig[key]} onChange={e => setAiConfig({...aiConfig, [key]: e.target.checked})} className="w-4 h-4 rounded text-purple-600 accent-purple-600" />
                          <span className="text-xs text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">🎨 Palette de couleurs</label>
                    <div className="flex gap-2">
                      {[["arc-en-ciel","🌈 Arc-en-ciel"],["mono","🔵 Monotone"],["chaleur","🔥 Chaleur"],["cool","❄️ Cool"]].map(([v,l]) => (
                        <button key={v} onClick={() => setAiConfig({...aiConfig, palette: v})} className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${aiConfig.palette === v ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

            </div>

            <div className="ai-modal-footer px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3 rounded-b-2xl">
              <div className="text-xs text-gray-400">
                <i className="fa-solid fa-circle-info mr-1"></i>
                {aiConfig.critereParQuestion
                  ? "Critères : auto (1 par question d'examen)"
                  : `${Math.max(1, Math.min(50, parseInt(aiConfig.nbCriteres, 10) || 4))} critères`} · {aiConfig.niveaux} niveaux
                {aiConfig.inclureSousCriteres ? " · Sous-critères" : ""}
                {aiConfig.inclureFeedbackGlobal ? " · 5 rétroactions" : ""}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAIModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition">Annuler</button>
                <button onClick={copyAITemplateToClipboard} className={`px-4 py-2 text-sm font-semibold text-white rounded-lg shadow transition flex items-center gap-2 ${aiCopySuccess ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  <i className={`fa-solid ${aiCopySuccess ? "fa-check" : "fa-copy"}`}></i>
                  {aiCopySuccess ? "Copié !" : "Copier le JSON"}
                </button>
                <button onClick={downloadAITemplate} className="px-6 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition flex items-center gap-2">
                  <i className="fa-solid fa-download"></i> Télécharger le gabarit
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
                <p className="text-xs text-gray-500 mt-0.5">Collez le contenu JSON complet de votre grille.</p>
              </div>
              <button onClick={() => setShowPasteJsonModal(false)} className="text-gray-400 hover:text-gray-600 text-xl"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6">
              <textarea
                rows={12}
                value={pastedJsonText}
                onChange={(e) => setPastedJsonText(e.target.value)}
                placeholder='{"title":"...","taskTitle":"...","criteria":[...]}'
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
