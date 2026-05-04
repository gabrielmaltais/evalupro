import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { distributePoints, normalizeImportedRubric } from "../lib/rubricTemplate";
import PageSectionTitle from "../components/PageSectionTitle";

/** Si le JSON vient du gabarit IA enveloppé, extraire la grille importable. */
function unwrapAiTemplateEnvelope(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.template_a_remplir && typeof raw.template_a_remplir === "object") return raw.template_a_remplir;
  return raw;
}

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
  const [rubricSearch, setRubricSearch] = useState("");
  const [rubricFilterGroup, setRubricFilterGroup] = useState("");
  const [rubricFilterStatus, setRubricFilterStatus] = useState("all");
  const [rubricSortBy, setRubricSortBy] = useState("updatedAt_desc");
  
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
    nbCriteres: "4",
    lierElementsCompetence: false,
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

  useEffect(() => {
    if (aiConfig.lierElementsCompetence && !aiConfig.inclureSousCriteres) {
      setAiConfig((c) => ({ ...c, inclureSousCriteres: true }));
    }
  }, [aiConfig.lierElementsCompetence, aiConfig.inclureSousCriteres]);

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
    const criteriaCountGuidance =
      cfg.lierElementsCompetence && autoOnePerQuestion
        ? (isEn
          ? "Create as many `criteria` objects as there are competency elements from the course plan that this exam assesses. The template below shows only ONE example row — repeat the same structure for each competency element."
          : "Créer autant d'objets dans `criteria` qu'il y a d'éléments de compétence du plan de cours à couvrir par cet examen. Ce gabarit ne montre qu'UNE ligne d'exemple — reproduire la même structure pour chaque élément de compétence.")
        : cfg.lierElementsCompetence && !autoOnePerQuestion
          ? (isEn
            ? `Create exactly ${nbCriteres} criteria in \`criteria\`, each aligned with a competency element from the course plan whenever possible.`
            : `Créer exactement ${nbCriteres} critères dans \`criteria\`, chacun aligné sur un élément de compétence du plan de cours lorsque c'est pertinent.`)
          : autoOnePerQuestion
            ? (isEn
              ? "Create exactly as many objects in `criteria` as there are graded questions (or distinct scored parts) in the exam. The template below shows only ONE example row — repeat the same structure for every question."
              : "Créer exactement autant d'objets dans `criteria` qu'il y a de questions (ou de parties notées distinctes) dans l'énoncé. Ce gabarit ne montre qu'UNE ligne d'exemple — reproduire la même structure pour chaque question.")
            : (isEn
              ? `Create exactly ${nbCriteres} criteria in \`criteria\`, aligned with the exam whenever it makes sense.`
              : `Créer exactement ${nbCriteres} critères dans \`criteria\`, alignés sur l'énoncé lorsque c'est pertinent.`);
    const pointsGuidance = autoOnePerQuestion
      ? (isEn
        ? "Each `weight` MUST match the points assigned to that question in the exam. The sum of all `weights` MUST equal the exam total (not necessarily 100). The value 0 here is only a placeholder in the single example row."
        : "Chaque `weight` DOIT reprendre les points de la question correspondante dans l'énoncé. La somme des `weight` DOIT égaler le total de l'examen (pas forcément 100). La valeur 0 sur l'exemple unique n'est qu'un substitut.")
      : (isEn
        ? "Replace every `weight` with the real points from the exam. The template weights are an illustrative split out of 100 — discard them if they disagree with the exam. The sum of `weights` MUST equal the exam total."
        : "Remplacer chaque `weight` par les points réels de l'énoncé. Les pondérations ci-dessous sont une répartition fictive sur 100 pour l'aperçu : ne pas les garder si elles contredisent l'examen. La somme des `weight` doit égaler le total de l'examen.");
    const subCriteriaSumGuidance = cfg.inclureSousCriteres
      ? (isEn
        ? "If `subCriteria` are used, the sum of `pts` for each criterion must equal that criterion's `weight`."
        : "Si `subCriteria` est utilisé, la somme des `pts` doit égaler le `weight` du critère parent.")
      : "";

    const strategieBase = isEn
      ? "Create one `criteria` per main exam question and use `subCriteria` for sub-questions."
      : "Crée un criteria pour chaque question principale de l'examen et utilise les subCriteria pour les sous-questions.";

    const STRATEGIE_EVALUATION_COMPETENCES_FR =
      "STRATÉGIE D'ÉVALUATION : Tu dois mapper les objets 'criteria' aux Éléments de compétence trouvés dans le plan de cours. Ensuite, utilise les 'subCriteria' pour lister les tâches ou consignes spécifiques du travail pratique qui permettent d'évaluer cette compétence.";
    const STRATEGIE_EVALUATION_COMPETENCES_EN =
      "EVALUATION STRATEGY: You must map the 'criteria' objects to the competency elements found in the course plan. Then use 'subCriteria' to list the specific tasks or instructions from the practical work that allow this competency to be assessed.";

    const strategie_evaluation = cfg.lierElementsCompetence
      ? (isEn ? STRATEGIE_EVALUATION_COMPETENCES_EN : STRATEGIE_EVALUATION_COMPETENCES_FR)
      : [strategieBase, "", criteriaCountGuidance, "", pointsGuidance, subCriteriaSumGuidance ? `\n${subCriteriaSumGuidance}` : ""]
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

    const role = isEn ? "Expert in college-level educational technology" : "Expert en technopédagogie collégiale";
    const regle_absolue_format = isEn
      ? 'You must extract and complete the \'template_a_remplir\' object below. Your final answer must be ONLY the completed JSON (starting with { "title": ... }). Do NOT include this \'_prompt_configuration\' object in your final answer.'
      : 'Tu dois extraire et remplir l\'objet \'template_a_remplir\' ci-dessous. Ta réponse finale doit être UNIQUEMENT le JSON rempli (commençant par { "title": ... }). N\'inclus SURTOUT PAS cet objet \'_prompt_configuration\' dans ta réponse finale.';
    const regles_mathematiques = isEn
      ? "The sum of 'weight' must equal the exam's total points. The sum of 'pts' in 'subCriteria' must exactly equal the parent criterion's 'weight'."
      : "La somme des 'weight' doit égaler le total des points de l'examen. La somme des 'pts' des 'subCriteria' doit égaler exactement le 'weight' du 'criteria' parent.";
    const regles_feedback = isEn
      ? "Write 5 personalized feedback messages (feedbackMessages), one per score band. The tone must be encouraging, motivating, professional, and respectful. Use a polite, professional register. NEVER copy instructional or placeholder text into the generated messages."
      : "Rédige 5 messages de rétroaction (feedbackMessages) personnalisés pour chaque tranche de note. Le ton doit être encourageant, motivant, professionnel et respectueux. Utilise le vouvoiement. Ne copie JAMAIS de texte d'instruction dans les messages générés.";

    const critTitleLabel = cfg.lierElementsCompetence
      ? (isEn ? "Competency element" : "Élément de compétence")
      : L.criterionName;

    const buildCriterion = (i) => {
      const weight = weights[i];
      const criterionTitleExample = cfg.lierElementsCompetence
        ? (isEn ? `Name of competency element ${i + 1}` : `Nom de l'élément de compétence ${i + 1}`)
        : `${critTitleLabel} ${i + 1} - remplacer par l'intitule exact`;
      const levels = niveauxBase.map((nv) => ({
        label: nv.label,
        maxPct: nv.maxPct,
        desc: cfg.inclureExemples
          ? cfg.lierElementsCompetence
            ? (isEn
              ? `${nv.desc}. Replace with a concrete observable example linked to this competency element.`
              : `${nv.desc}. Remplacer par un exemple concret et observable lié à cet élément de compétence.`)
            : (isEn
              ? `${nv.desc}. Replace with a concrete observable example linked to this question.`
              : `${nv.desc}. Remplacer par un exemple concret et observable lié à cette question.`)
          : `${nv.desc}.`,
      }));
      const criterion = {
        id: makeId("c", i + 1),
        title: criterionTitleExample,
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

    const feedbackPlaceholder = isEn ? "Generate the feedback message here" : "Générer le message de rétroaction ici";
    const feedbackMessages = cfg.inclureFeedbackGlobal ? tranches.map(([min, max]) => ({
      minPct: min,
      maxPct: max,
      message: feedbackPlaceholder,
    })) : undefined;

    const template_a_remplir = {
      title: L.title,
      taskTitle: L.taskTitle,
      criteria: criteriaExamples,
      ...(feedbackMessages ? { feedbackMessages } : {}),
    };

    return {
      _prompt_configuration: {
        role,
        regle_absolue_format,
        strategie_evaluation,
        regles_mathematiques,
        ...(cfg.inclureFeedbackGlobal ? { regles_feedback } : {}),
        instructions_specifiques_utilisateur: teacherNotes || null,
      },
      template_a_remplir,
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
    const result = normalizeImportedRubric(unwrapAiTemplateEnvelope(json), { defaultFeedbackMessages: DEFAULT_FEEDBACK });
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
      /* Ne pas réinitialiser savedSnapshot : sinon l'effet synchrone réécrit le snapshot avec le
         formulaire importé et l'UI affiche « tout enregistré » alors qu'aucun POST n'a eu lieu. */
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
  const filteredRubrics = useMemo(() => {
    const q = rubricSearch.trim().toLowerCase();
    const out = rubrics.filter((r) => {
      if (rubricFilterStatus === "active" && !r.isActive) return false;
      if (rubricFilterStatus === "inactive" && r.isActive) return false;
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
    return out;
  }, [rubrics, rubricSearch, rubricFilterGroup, rubricFilterStatus, rubricSortBy]);

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
            <div className="space-y-2 border-b border-gray-100 bg-white px-3 py-3">
              <input
                type="text"
                value={rubricSearch}
                onChange={(e) => setRubricSearch(e.target.value)}
                placeholder="Rechercher une grille, un cours, un groupe..."
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={rubricFilterStatus}
                  onChange={(e) => setRubricFilterStatus(e.target.value)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="all">Tous statuts</option>
                  <option value="active">Actives</option>
                  <option value="inactive">Inactives</option>
                </select>
                <select
                  value={rubricFilterGroup}
                  onChange={(e) => setRubricFilterGroup(e.target.value)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="">Tous groupes</option>
                  {groupOptions.map((g) => (
                    <option key={`flt-${g}`} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
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
                {filteredRubrics.length} / {rubrics.length} grille(s) affichée(s)
              </p>
            </div>
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {filteredRubrics.map(r => (
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
              {filteredRubrics.length === 0 && <li className="p-4 text-sm text-gray-500 text-center">Aucune grille pour ce filtre.</li>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-3" onClick={(e) => e.target === e.currentTarget && setShowAIModal(false)}>
          <div className="ai-modal-shell flex max-h-[min(90vh,700px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-2xl">
            <div className="ai-modal-header flex flex-shrink-0 items-start justify-between gap-2 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50/80 px-3 py-2.5 sm:px-4">
              <div className="min-w-0 pr-1">
                <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-1.5"><i className="fa-solid fa-robot text-indigo-600 flex-shrink-0 text-[15px] sm:text-base"></i> Configurateur de Gabarit IA</h2>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Personnalisez les options pour générer un gabarit JSON adapté.</p>
              </div>
              <button type="button" onClick={() => setShowAIModal(false)} className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:bg-white/80 hover:text-gray-700" aria-label="Fermer"><i className="fa-solid fa-xmark text-base"></i></button>
            </div>

            <div className="ai-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-3.5 space-y-3.5">

              {/* Instructions IA (lue par le modèle avec le gabarit) */}
              <section className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800"><i className="fa-solid fa-wand-magic-sparkles mr-1 text-indigo-500 text-[11px]"></i> Instructions pour l&apos;IA</label>
                <textarea rows={2} placeholder="Ex: Viser la même découpe que l'énoncé officiel. Ton formel. Insister sur la conformité aux consignes de remise." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-300 resize-none" value={aiConfig.instructionsIa} onChange={e => setAiConfig({...aiConfig, instructionsIa: e.target.value})} />
                <p className="text-[10px] text-gray-500 leading-snug">Copiées dans <code className="text-[9px] bg-gray-100 text-gray-700 px-1 py-px rounded border border-gray-200/80">_prompt_configuration.instructions_specifiques_utilisateur</code>.</p>
              </section>

              <section className="rounded-lg border border-emerald-200/90 bg-emerald-50/60 px-3 py-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <label htmlFor="lier-competence-toggle" className="text-xs font-bold text-emerald-950 cursor-pointer leading-snug pr-1">
                    Lier l&apos;évaluation aux éléments de compétence (recommandé pour les travaux pratiques)
                  </label>
                  <button
                    id="lier-competence-toggle"
                    type="button"
                    aria-pressed={aiConfig.lierElementsCompetence}
                    onClick={() => {
                      const next = !aiConfig.lierElementsCompetence;
                      setAiConfig({
                        ...aiConfig,
                        lierElementsCompetence: next,
                        ...(next ? { inclureSousCriteres: true } : {}),
                      });
                    }}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig.lierElementsCompetence ? "bg-emerald-600" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig.lierElementsCompetence ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
                <p className="text-[11px] text-emerald-900/90 leading-snug border-t border-emerald-200/60 pt-2">
                  {aiConfig.lierElementsCompetence
                    ? "Stratégie du gabarit : compétences du plan de cours → critères ; tâches d&apos;examen → sous-critères."
                    : "Stratégie par défaut : une question principale → un critère ; sous-questions → sous-critères (examens classiques)."}
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Langue */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Langue du gabarit</label>
                  <div className="flex gap-1.5">
                    {[["fr","Français"],["en","English"]].map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, langue: v})} className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold border transition-all ${aiConfig.langue === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Niveau étudiants */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Niveau des étudiants</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[["secondaire","Secondaire"],["collegial","Collégial"],["universitaire","Universitaire"]].map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, niveauEtudiants: v})} className={`min-w-0 flex-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold border transition-all ${aiConfig.niveauEtudiants === v ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <section className="rounded-lg border border-gray-200 bg-slate-50/90 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><i className="fa-solid fa-sliders text-indigo-600 text-[11px]"></i> Mode avancé</p>
                  <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">Réglages détaillés par section.</p>
                </div>
                <button type="button" onClick={() => setShowAIAdvanced(!showAIAdvanced)} className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${showAIAdvanced ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showAIAdvanced ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
                {/* Niveaux */}
                <div className="space-y-1.5 rounded-lg border border-gray-200/90 bg-white p-2.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Niveaux de performance</label>
                  <div className="grid grid-cols-2 gap-1">
                    {[["2","2 — Échec/Réussite"],["3","3 — Standard"],["4","4 — Graduel"],["5","5 — Granulaire"]].map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, niveaux: v})} className={`py-1 px-1.5 rounded-md text-[10px] font-medium border transition-all text-left leading-tight ${aiConfig.niveaux === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50/80 text-gray-700 border-gray-200 hover:border-gray-300'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Nb critères */}
                <div className="space-y-1.5 rounded-lg border border-gray-200/90 bg-white p-2.5 flex flex-col">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Nombre de questions / critères</label>
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90">
                    <span className="text-[11px] font-semibold text-amber-950 leading-tight">1 critère = 1 question</span>
                    <button type="button" onClick={() => setAiConfig({...aiConfig, critereParQuestion: !aiConfig.critereParQuestion})} className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig.critereParQuestion ? 'bg-amber-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig.critereParQuestion ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {!aiConfig.critereParQuestion && (
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={aiConfig.nbCriteres}
                    onChange={e => setAiConfig({
                      ...aiConfig,
                      nbCriteres: e.target.value,
                    })}
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-400/70"
                    placeholder="Ex: 4 critères"
                  />
                  )}
                  <p className="text-[10px] text-gray-600 mt-auto pt-0.5 leading-snug">
                    {aiConfig.critereParQuestion
                      ? "Mode automatique : le gabarit indique au modèle de créer un critère par question de l'énoncé."
                      : "Mode personnalisé : définissez un nombre de critères ; le gabarit rappelle toutefois d'aligner les points sur l'énoncé."}
                  </p>
                </div>
              </div>

              {/* Sous-critères */}
              <section className="rounded-lg border border-gray-200/90 bg-slate-50/70 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-800 leading-snug">Sous-critères (cases à cocher techniques)</label>
                  <button
                    type="button"
                    disabled={aiConfig.lierElementsCompetence}
                    aria-disabled={aiConfig.lierElementsCompetence}
                    title={aiConfig.lierElementsCompetence ? "Obligatoire lorsque l'évaluation est liée aux compétences" : undefined}
                    onClick={() => {
                      if (aiConfig.lierElementsCompetence) return;
                      setAiConfig({ ...aiConfig, inclureSousCriteres: !aiConfig.inclureSousCriteres });
                    }}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig.inclureSousCriteres ? "bg-indigo-600" : "bg-gray-300"} ${aiConfig.lierElementsCompetence ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig.inclureSousCriteres ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
                {aiConfig.lierElementsCompetence && (
                  <p className="text-[10px] text-gray-600 leading-snug border-l-2 border-indigo-300 pl-2">Sous-critères activés automatiquement pour les tâches d&apos;examen sous chaque élément de compétence.</p>
                )}
                {showAIAdvanced && aiConfig.inclureSousCriteres && (
                  <div className="space-y-2 pl-1.5 border-l-2 border-indigo-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-700 leading-snug">Feedback si sous-critère non coché</span>
                      <button type="button" onClick={() => setAiConfig({...aiConfig, sousCritereFeedback: !aiConfig.sousCritereFeedback})} className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig.sousCritereFeedback ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig.sousCritereFeedback ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {aiConfig.sousCritereFeedback && (
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Style du feedback :</p>
                        <div className="flex gap-1.5">
                          {[["court","Court (1 phrase)"],["verbeux","Détaillé (2-3 phrases)"]].map(([v,l]) => (
                            <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, sousCritereFeedbackStyle: v})} className={`flex-1 py-1 px-1.5 rounded-md text-[10px] font-medium border transition-all ${aiConfig.sousCritereFeedbackStyle === v ? 'bg-indigo-100 text-indigo-800 border-indigo-400' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Rétroaction globale */}
              <section className="rounded-lg border border-gray-200/90 bg-slate-50/70 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-800 leading-snug">Rétroactions globales (feedbackMessages)</label>
                  <button type="button" onClick={() => setAiConfig({...aiConfig, inclureFeedbackGlobal: !aiConfig.inclureFeedbackGlobal})} className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${aiConfig.inclureFeedbackGlobal ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${aiConfig.inclureFeedbackGlobal ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                {showAIAdvanced && aiConfig.inclureFeedbackGlobal && (
                  <div className="space-y-2 pl-1.5 border-l-2 border-indigo-200/80">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Nombre de tranches :</p>
                      <div className="py-1 px-2 rounded-md text-[10px] font-medium border bg-white text-gray-700 border-gray-200 inline-block">
                        5 tranches (fixe)
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Ton de la rétroaction :</p>
                      <div className="grid grid-cols-2 gap-1">
                        {[["encourageant","Encourageant"],["formel","Formel"],["direct","Direct pro."],["verbeux","Verbeux"]].map(([v,l]) => (
                          <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, tonFeedback: v})} className={`py-1 px-1.5 rounded-md text-[10px] font-medium border transition-all ${aiConfig.tonFeedback === v ? 'bg-indigo-100 text-indigo-800 border-indigo-400' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 leading-snug">Tous les tons restent professionnels et respectueux.</p>
                    </div>
                  </div>
                )}
              </section>

              {showAIAdvanced && (
                <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-2.5">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Options avancées</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        ["inclureExemples","Exemples concrets dans les niveaux"],
                        ["idsSemantics","IDs sémantiques (ex: c-nat-1)"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50/80 transition-colors">
                          <input type="checkbox" checked={aiConfig[key]} onChange={e => setAiConfig({...aiConfig, [key]: e.target.checked})} className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600" />
                          <span className="text-[10px] text-gray-800 leading-snug">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Palette de couleurs</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {[["arc-en-ciel","Arc-en-ciel"],["mono","Monotone"],["chaleur","Chaleur"],["cool","Cool"]].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setAiConfig({...aiConfig, palette: v})} className={`py-1 px-1 rounded-md text-[10px] font-semibold border transition-all ${aiConfig.palette === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="ai-modal-footer flex flex-shrink-0 flex-col gap-2 border-t border-gray-200 bg-slate-50/90 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4 rounded-b-xl">
              <div className="min-w-0 flex-1 text-[10px] text-gray-500 leading-snug order-2 sm:order-1">
                <i className="fa-solid fa-circle-info mr-0.5 flex-shrink-0 text-gray-400"></i>
                {aiConfig.critereParQuestion
                  ? "Critères : auto (1 par question d'examen)"
                  : `${Math.max(1, Math.min(50, parseInt(aiConfig.nbCriteres, 10) || 4))} critères`} · {aiConfig.niveaux} niveaux
                {aiConfig.inclureSousCriteres ? " · Sous-critères" : ""}
                {aiConfig.inclureFeedbackGlobal ? " · 5 rétroactions" : ""}
                {aiConfig.lierElementsCompetence ? " · Compétences (TP)" : " · Par questions"}
              </div>
              <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-1.5 order-1 sm:order-2">
                <button type="button" onClick={() => setShowAIModal(false)} className="whitespace-nowrap px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition sm:px-3">Annuler</button>
                <button type="button" onClick={copyAITemplateToClipboard} className={`whitespace-nowrap px-2 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1 sm:gap-1.5 sm:px-3 ${aiCopySuccess ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  <i className={`fa-solid text-[11px] ${aiCopySuccess ? "fa-check" : "fa-copy"}`}></i>
                  {aiCopySuccess ? "Copié !" : "Copier le JSON"}
                </button>
                <button type="button" onClick={downloadAITemplate} className="whitespace-nowrap px-2 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1 sm:gap-1.5 sm:px-3">
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
