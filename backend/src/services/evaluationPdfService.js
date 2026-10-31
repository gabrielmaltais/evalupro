const { toPlainObject, computeEvaluationTotals } = require("../utils/evaluationTotals");

function sanitizeFilePart(v) {
  return String(v || "")
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function getNumber(obj, key) {
  if (!obj) return undefined;
  const k = String(key);
  if (obj[k] !== undefined) return Number(obj[k]);
  if (obj[key] !== undefined) return Number(obj[key]);
  return undefined;
}

function getScore(scores, cid) {
  const o = toPlainObject(scores);
  const v = getNumber(o, cid);
  return v === undefined ? 0 : v;
}

function getSubBlock(subScores, cid) {
  const o = toPlainObject(subScores);
  const block = o[cid] ?? o[String(cid)];
  if (!block || typeof block !== "object") return {};
  return block;
}

function levelThreshold(level) {
  return Number.isFinite(level && level.minPct) ? level.minPct : (level && level.maxPct) || 0;
}

// `true` (ancien format) = tous les points; nombre = points partiels; sinon 0.
function taskPoints(task, value) {
  const max = Number(task.pts) || 0;
  if (value === true) return max;
  const n = Number(value);
  if (value === false || value === null || value === undefined || value === "" || !Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, Math.min(0, max)), Math.max(0, max));
}

function computeTotals(rubric, scoresObj) {
  return computeEvaluationTotals(rubric, scoresObj);
}

function pickFeedbackMessage(rubric, finalPct) {
  const msgs = rubric.feedbackMessages;
  if (!msgs || !msgs.length) return null;
  return msgs.find((fm) => finalPct >= fm.minPct && finalPct <= fm.maxPct) || null;
}

const MISSED_KEY = "_manques";
const LEVELS_KEY = "_niveaux";

// Même règle qu'à l'écran (frontend/src/lib/rubricTemplate.js taskFeedback): quand la tâche propose des
// éléments à cocher, seule la sélection de l'enseignant sert; sinon, le texte général de la tâche.
function taskFeedback(task, missed) {
  const list = (missed || []).filter(Boolean);
  if (!list.length) return task.checks && task.checks.length ? "" : task.feedback || "";
  const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function pickLevel(levels, pct) {
  if (!levels || !levels.length) return null;
  const sorted = [...levels].sort((a, b) => levelThreshold(a) - levelThreshold(b));
  let m = sorted[0];
  for (const l of sorted) if (pct >= levelThreshold(l)) m = l;
  return m;
}

// Helvetica (WinAnsi) n'affiche ni emoji ni symboles: on les retire pour éviter les caractères parasites.
function latin(text) {
  return String(text || "").replace(/[^ -~ -ÿ‘’“”–—…Œœ]/g, "").replace(/\s+/g, " ").trim();
}

function formatDate(iso) {
  try {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    return d.toLocaleDateString("fr-CA", { dateStyle: "long", timeZone: "UTC" });
  } catch {
    return "";
  }
}

const NUM = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

const pct1 = (b) => (b.max ? b.earned / b.max : 0);
const short = (str, n = 78) => (str.length > n ? `${str.slice(0, n - 1).trim()}…` : str);

/** Résumé écrit à l'élève à partir de ses résultats par étape (points forts, priorité). */
function openingText(firstName, totalScore, totalMax, finalPct, blocks, lost) {
  const parts = [`${firstName}, tu as obtenu ${NUM(Math.round(totalScore * 10) / 10)} sur ${NUM(totalMax)} (${Math.round(finalPct)} %).`];
  if (!lost.length) {
    parts.push("Tous les points sont acquis : chaque élément demandé a été réalisé correctement.");
    return parts.join(" ");
  }
  if (blocks.length > 1) {
    const ranked = [...blocks].sort((a, b) => pct1(b) - pct1(a));
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (pct1(best) > pct1(worst)) {
      parts.push(`Ton point le plus solide est « ${latin(best.name)} » (${NUM(best.earned)} sur ${NUM(best.max)}).`);
      parts.push(`C'est dans « ${latin(worst.name)} » (${NUM(worst.earned)} sur ${NUM(worst.max)}) que se trouvent le plus de points à aller chercher.`);
    }
  }
  return parts.join(" ");
}

function getEvaluationPdfFileName(evaluation, rubric) {
  const exam = sanitizeFilePart(rubric.taskTitle || rubric.title || "Evaluation");
  const student = sanitizeFilePart(evaluation.studentName || "Etudiant");
  return `${exam}-${student}.pdf`;
}

module.exports = {
  getEvaluationPdfFileName,
  // Outils partagés avec les modèles de PDF (evaluationPdfThemes.js).
  helpers: { getScore, getNumber, getSubBlock, taskPoints, computeTotals, pickFeedbackMessage, taskFeedback, pickLevel, latin, formatDate, NUM, openingText, pct1, short, MISSED_KEY, LEVELS_KEY },
};
