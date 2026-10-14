/** Calcul des totaux d'une évaluation, identique pour l'API, le PDF et l'affichage. */

function toPlainObject(mapLike) {
  if (!mapLike) return {};
  if (mapLike instanceof Map) return Object.fromEntries(mapLike);
  if (typeof mapLike.toObject === "function") return mapLike.toObject();
  if (typeof mapLike === "object") return { ...mapLike };
  return {};
}

/** Clé sous laquelle la note d'un critère est enregistrée (id du critère, sinon _id, sinon position). */
function criterionKey(criterion, index) {
  if (criterion.id != null && criterion.id !== "") return String(criterion.id);
  if (criterion._id != null) return String(criterion._id);
  return String(index);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Somme des notes des critères de la grille uniquement (les notes d'un critère supprimé sont ignorées),
 * chaque note étant bornée entre 0 et la pondération du critère.
 */
function computeEvaluationTotals(rubric, scoresLike) {
  const scores = toPlainObject(scoresLike);
  let totalMax = 0;
  let totalScore = 0;
  (rubric?.criteria || []).forEach((c, i) => {
    const weight = Math.max(0, Number(c.weight) || 0);
    const raw = Number(scores[criterionKey(c, i)]);
    totalMax += weight;
    totalScore += Number.isFinite(raw) ? Math.min(weight, Math.max(0, raw)) : 0;
  });
  return { totalScore: round2(totalScore), totalMax: round2(totalMax) };
}

module.exports = { toPlainObject, criterionKey, computeEvaluationTotals };
