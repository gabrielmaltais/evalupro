const Rubric = require("../models/Rubric");
const Evaluation = require("../models/Evaluation");

/**
 * Reporte la modification des compétences d'un cours sur les critères d'une grille.
 * Un critère est rattaché à sa compétence par `competencyId`, ou à défaut par son `competencyElement`
 * qui reprend le titre de la compétence (grilles produites par le gabarit). Si le titre du critère était
 * celui de la compétence, il suit; si la compétence a été retirée, le lien est coupé (le texte reste).
 */
function syncCriteria(criteria, oldComps, newComps) {
  const oldById = new Map(oldComps.map((c) => [c.id, c]));
  const oldByTitle = new Map(oldComps.map((c) => [c.title, c]));
  const newById = new Map(newComps.map((c) => [c.id, c]));
  let changed = false;
  const next = criteria.map((cr) => {
    const plain = cr.toObject ? cr.toObject() : { ...cr };
    const old = (plain.competencyId && oldById.get(plain.competencyId)) || oldByTitle.get(plain.competencyElement);
    if (!old) return plain;
    const fresh = newById.get(old.id);
    const out = { ...plain };
    if (!fresh) {
      if (out.competencyId) {
        out.competencyId = "";
        changed = true;
      }
      return out;
    }
    if (out.competencyId !== old.id) {
      out.competencyId = old.id;
      changed = true;
    }
    if (out.competencyElement !== fresh.title) {
      out.competencyElement = fresh.title;
      changed = true;
    }
    if (out.title === old.title && fresh.title !== old.title) {
      out.title = fresh.title;
      changed = true;
    }
    return out;
  });
  return { criteria: next, changed };
}

/**
 * Met à jour les grilles encore intactes du cours (non archivées, sans aucune évaluation): les grilles déjà
 * utilisées en correction gardent leur libellé pour ne pas changer l'historique.
 */
async function syncCourseRubrics(ownerId, courseId, oldComps, newComps) {
  const rubrics = await Rubric.find({ createdBy: ownerId, course: courseId, archivedAt: null });
  const used = new Set((await Evaluation.find({ owner: ownerId, rubric: { $in: rubrics.map((r) => r._id) } }).distinct("rubric")).map(String));
  let updated = 0;
  let skipped = 0;
  for (const rubric of rubrics) {
    const { criteria, changed } = syncCriteria(rubric.criteria, oldComps, newComps);
    if (!changed) continue;
    if (used.has(String(rubric._id))) {
      skipped += 1;
      continue;
    }
    rubric.criteria = criteria;
    await rubric.save();
    updated += 1;
  }
  return { updated, skipped };
}

module.exports = { syncCriteria, syncCourseRubrics };
