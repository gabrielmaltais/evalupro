const VALID_COLORS = new Set([
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
  "border-orange-500",
  "border-red-500",
  "border-gray-500",
  "border-indigo-500",
  "border-cyan-500",
  "border-yellow-500",
]);

const DEFAULT_LEVELS = [
  { label: "Insuffisant", maxPct: 0, desc: "Absent, incomplet ou non fonctionnel." },
  { label: "Acceptable", maxPct: 0.65, desc: "Partiellement réussi avec des erreurs ou des éléments manquants." },
  { label: "Excellent", maxPct: 1, desc: "Complet, fonctionnel et conforme aux attentes." },
];

export function clampNumber(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function distributePoints(total, count) {
  const safeCount = Math.max(1, Number.parseInt(count, 10) || 1);
  const safeTotal = Math.max(0, Number(total) || 0);
  const cents = Math.round(safeTotal * 100);
  const base = Math.floor(cents / safeCount);
  let remainder = cents - base * safeCount;
  return Array.from({ length: safeCount }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return Number((value / 100).toFixed(2));
  });
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function parsePoints(value) {
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
    return normalized ? Number(normalized[0]) : undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePct(value, fallback) {
  const n = parsePoints(value);
  if (n === undefined) return fallback;
  if (n > 1) return clampNumber(n / 100, 0, 1, fallback);
  return clampNumber(n, 0, 1, fallback);
}

function cleanId(value, fallback, usedIds) {
  const base = asText(value, fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
  let candidate = base;
  let n = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function pickCriteriaSource(json) {
  if (Array.isArray(json?.criteria)) return json.criteria;
  if (Array.isArray(json?.criteres)) return json.criteres;
  if (Array.isArray(json?.critères)) return json.critères;
  if (Array.isArray(json?.questions)) return json.questions;
  if (Array.isArray(json?.config?.criteria)) return json.config.criteria;
  if (Array.isArray(json?.rubric?.criteria)) return json.rubric.criteria;
  if (Array.isArray(json?.grille?.criteria)) return json.grille.criteria;
  if (Array.isArray(json?.grille?.criteres)) return json.grille.criteres;
  if (Array.isArray(json?.grille?.critères)) return json.grille.critères;
  return [];
}

function questionAt(json, index) {
  const questions = asArray(json?.questions);
  return questions[index] || {};
}

function pickSubCriteria(raw, matchingQuestion) {
  return firstDefined(
    raw.subCriteria,
    raw.subcriteria,
    raw.sub_criteria,
    raw.sousCriteres,
    raw.sous_criteres,
    raw.sousCritères,
    raw.subQuestions,
    raw.subquestions,
    raw.sousQuestions,
    raw.items,
    raw.checklist,
    matchingQuestion.subCriteria,
    matchingQuestion.subQuestions,
    matchingQuestion.sousQuestions,
    matchingQuestion.items,
  );
}

function normalizeLevels(rawLevels) {
  const source = asArray(rawLevels).length ? asArray(rawLevels) : DEFAULT_LEVELS;
  const levels = source.map((level, index) => ({
    label: asText(firstDefined(level.label, level.name, level.nom, level.titre), DEFAULT_LEVELS[index]?.label || `Niveau ${index + 1}`),
    maxPct: normalizePct(firstDefined(level.maxPct, level.max, level.percent, level.pct, level.pourcentage, level.score), DEFAULT_LEVELS[index]?.maxPct ?? 1),
    desc: asText(firstDefined(level.desc, level.description, level.feedback, level.message, level.details), DEFAULT_LEVELS[index]?.desc || "Description du niveau."),
  }));

  const sorted = levels
    .filter((level) => level.label && level.desc)
    .sort((a, b) => a.maxPct - b.maxPct);

  if (!sorted.length) return DEFAULT_LEVELS;
  sorted[sorted.length - 1] = { ...sorted[sorted.length - 1], maxPct: 1 };
  return sorted;
}

function normalizeSubCriteria(rawSubCriteria, criterionId, criterionWeight, usedIds) {
  const source = asArray(rawSubCriteria).filter(Boolean);
  if (!source.length) return [];

  const pointValues = source.map((item) => parsePoints(firstDefined(item.pts, item.points, item.pointage, item.weight, item.poids, item.score)));
  const missingPoints = pointValues.every((value) => value === undefined);
  const missingCount = pointValues.filter((value) => value === undefined).length;
  const providedTotal = pointValues.reduce((sum, value) => sum + (value ?? 0), 0);
  const distributed = distributePoints(missingPoints ? criterionWeight : Math.max(0, criterionWeight - providedTotal), missingPoints ? source.length : missingCount);
  let distributedIndex = 0;

  return source.map((item, index) => {
    const label = asText(
      firstDefined(item.label, item.libelle, item.libellé, item.title, item.titre, item.name, item.nom, item.text, item.texte, item.question, item.description),
      `Point ${index + 1}`,
    );
    const fallbackPts = pointValues[index] === undefined ? (distributed[distributedIndex++] ?? 0) : pointValues[index];
    const pts = Number(fallbackPts.toFixed(2));
    return {
      id: cleanId(firstDefined(item.id, item.key), `${criterionId}-sc${index + 1}`, usedIds),
      label,
      pts,
      feedback: asText(firstDefined(item.feedback, item.retroaction, item.rétroaction, item.comment, item.commentaire), ""),
    };
  });
}

export function normalizeImportedRubric(json, options = {}) {
  const sourceCriteria = pickCriteriaSource(json);
  if (!sourceCriteria.length) {
    return { ok: false, error: "Le JSON ne contient pas de critères ou de questions valides." };
  }

  const usedIds = new Set();
  const explicitWeights = sourceCriteria.map((criterion, index) => {
    const question = questionAt(json, index);
    return parsePoints(firstDefined(
      criterion.weight,
      criterion.points,
      criterion.pts,
      criterion.pointage,
      criterion.poids,
      criterion.score,
      question.points,
      question.pts,
      question.pointage,
    ));
  });
  const fallbackWeights = distributePoints(100, sourceCriteria.length);

  const criteria = sourceCriteria.map((criterion, index) => {
    const matchingQuestion = questionAt(json, index);
    const criterionId = cleanId(firstDefined(criterion.id, criterion.key), `c${index + 1}`, usedIds);
    const rawSubCriteria = pickSubCriteria(criterion, matchingQuestion);
    const subCriteriaPointTotal = asArray(rawSubCriteria).reduce((sum, item) => {
      const pts = parsePoints(firstDefined(item.pts, item.points, item.pointage, item.weight, item.poids, item.score));
      return sum + (Number.isFinite(pts) ? pts : 0);
    }, 0);
    const weight = explicitWeights[index] ?? (subCriteriaPointTotal > 0 ? subCriteriaPointTotal : fallbackWeights[index]);

    return {
      id: criterionId,
      title: asText(
        firstDefined(criterion.title, criterion.titre, criterion.libelle, criterion.libellé, criterion.name, criterion.nom, criterion.criterion, criterion.critere, criterion.critère, matchingQuestion.title, matchingQuestion.titre, matchingQuestion.question, matchingQuestion.text, matchingQuestion.texte),
        `Critère ${index + 1}`,
      ),
      weight: Number(Math.max(0, weight).toFixed(2)),
      color: VALID_COLORS.has(criterion.color) ? criterion.color : options.defaultColor || "border-blue-500",
      levels: normalizeLevels(firstDefined(criterion.levels, criterion.niveaux, criterion.performanceLevels, criterion.descriptors)),
      subCriteria: normalizeSubCriteria(rawSubCriteria, criterionId, Math.max(0, weight), usedIds),
    };
  });

  return {
    ok: true,
    rubric: {
      title: asText(firstDefined(json.title, json.titre, json.courseTitle, json.cours, json.nomCours, json.rubric?.title, json.grille?.title, json.grille?.titre), "Grille importée"),
      taskTitle: asText(firstDefined(json.taskTitle, json.task, json.tache, json.tâche, json.assignment, json.examen, json.rubric?.taskTitle, json.grille?.taskTitle, json.grille?.tache, json.grille?.tâche), "Travail final"),
      groups: Array.isArray(json.groups) && json.groups.length ? json.groups.map((g) => String(g).trim()).filter(Boolean) : (json.group ? [String(json.group).trim()].filter(Boolean) : []),
      criteria,
      feedbackMessages: normalizeFeedbackMessages(json.feedbackMessages, options.defaultFeedbackMessages),
    },
  };
}

export function normalizeFeedbackMessages(messages, fallback = []) {
  const source = asArray(messages);
  if (!source.length) return fallback;
  const normalized = source
    .map((message) => ({
      minPct: clampNumber(firstDefined(message.minPct, message.min, message.from, message.de), 0, 100, 0),
      maxPct: clampNumber(firstDefined(message.maxPct, message.max, message.to, message.a), 0, 100, 100),
      message: asText(firstDefined(message.message, message.text, message.feedback, message.retroaction), ""),
    }))
    .filter((message) => message.message);
  return normalized.length ? normalized : fallback;
}
