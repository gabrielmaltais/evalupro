const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const Rubric = require("../models/Rubric");
const Course = require("../models/Course");
const Group = require("../models/Group");
const Evaluation = require("../models/Evaluation");
const { resolveActiveSession } = require("../services/sessionService");
const { computeEvaluationTotals } = require("../utils/evaluationTotals");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");

const router = express.Router();

/**
 * Une grille est classée dans un cours; elle est utilisable en correction pour les groupes de la session
 * active dans lesquels elle a été importée. `groups` (noms) en est la vue.
 */
async function activeGroups(req) {
  const session = await resolveActiveSession(req.user);
  if (!session) return [];
  return Group.find({ createdBy: req.user._id, session: session._id, archivedAt: null }).sort({ name: 1 });
}

const imported = (g, rubricId) => (g.rubrics || []).some((r) => String(r) === String(rubricId));

async function withGroups(req, rubrics) {
  const groups = await activeGroups(req);
  return rubrics.map((r) => {
    const plain = r.toObject ? r.toObject() : r;
    const names = groups.filter((g) => imported(g, plain._id)).map((g) => g.name);
    return { ...plain, groups: names, group: names[0] || "" };
  });
}

/** Importe/retire la grille dans les groupes de la session active pour que seuls ceux indiqués l'aient. */
async function setGroupsByName(req, rubric, rawNames) {
  const names = new Set((rawNames || []).map((n) => String(n || "").trim()).filter(Boolean));
  for (const g of await activeGroups(req)) {
    const want = names.has(g.name);
    if (want && !imported(g, rubric._id)) {
      await Group.updateOne({ _id: g._id }, { $addToSet: { rubrics: rubric._id, courses: rubric.course } });
    } else if (!want && imported(g, rubric._id)) {
      await Group.updateOne({ _id: g._id }, { $pull: { rubrics: rubric._id } });
    }
  }
}

const rubricSchema = z.object({
  title: z.string().min(1),
  taskTitle: z.string().min(1),
  version: z.number().int().min(1),
  isActive: z.boolean().optional(),
  linkCompetencies: z.boolean().optional(),
  course: z.string().min(1, "Choisis le cours dans lequel classer la grille"),
  group: z.string().optional(),
  groups: z.array(z.string()).optional(),
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      competencyElement: z.string().optional(),
      competencyId: z.string().optional(),
      weight: z.number().nonnegative(),
      color: z.string().optional(),
      levels: z.array(z.object({ label: z.string(), maxPct: z.number().min(0).max(1), minPct: z.number().min(0).max(1).optional(), desc: z.string() })).optional(),
      subCriteria: z.array(z.object({ id: z.string(), label: z.string(), pts: z.number(), feedback: z.string().optional() })).optional(),
    })
  ),
  feedbackMessages: z.array(z.object({ minPct: z.number(), maxPct: z.number(), message: z.string() })).optional(),
});

router.use(auth);

/** Chaque utilisateur a son espace : une grille n'est visible et modifiable que par son créateur. */
const mine = (req, id, extra = {}) => ({ _id: id, createdBy: req.user._id, ...extra });

/** Recalcule les totaux des évaluations d'une grille après modification de ses critères. */
async function recomputeEvaluationTotals(rubric) {
  const evals = await Evaluation.find({ rubric: rubric._id }).select("scores totalScore totalMax").lean();
  const ops = [];
  for (const ev of evals) {
    const { totalScore, totalMax } = computeEvaluationTotals(rubric, ev.scores);
    if (totalScore !== ev.totalScore || totalMax !== ev.totalMax) {
      ops.push({ updateOne: { filter: { _id: ev._id }, update: { $set: { totalScore, totalMax } } } });
    }
  }
  if (ops.length) await Evaluation.bulkWrite(ops);
}

async function resolveCourse(req, value) {
  if (value === undefined) return undefined;
  if (!value || !mongoose.isValidObjectId(value)) throw new Error("Cours invalide");
  const c = await Course.findOne({ _id: value, createdBy: req.user._id }).select("_id");
  if (!c) throw new Error("Cours introuvable");
  return c._id;
}

router.get("/", async (req, res) => {
  const archived = req.query.archived === "1" || req.query.archived === "true";
  const items = await Rubric.find({ createdBy: req.user._id, archivedAt: archived ? { $ne: null } : null }).sort({ createdAt: -1 });
  res.json(await withGroups(req, items));
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const { groups, group, ...payload } = rubricSchema.parse(req.body);
    const course = await resolveCourse(req, payload.course);
    const item = await Rubric.create({ ...payload, course, createdBy: req.user._id });
    if (groups !== undefined || group !== undefined) await setGroupsByName(req, item, groups ?? [group]);
    const [out] = await withGroups(req, [item]);
    res.status(201).json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const { groups, group, ...payload } = rubricSchema.partial().parse(req.body);
    const course = await resolveCourse(req, payload.course);
    if (course !== undefined) payload.course = course;
    const item = await Rubric.findOneAndUpdate(mine(req, req.params.id), payload, { new: true });
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    if (payload.criteria) await recomputeEvaluationTotals(item);
    if (groups !== undefined || group !== undefined) await setGroupsByName(req, item, groups ?? [group]);
    const [out] = await withGroups(req, [item]);
    res.json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

/** Importe la grille dans les groupes indiqués de la session active (et la retire des autres). */
router.put("/:id/groups", roles("admin", "teacher"), async (req, res) => {
  try {
    const { groupIds } = z.object({ groupIds: z.array(z.string()) }).parse(req.body);
    const item = await Rubric.findOne(mine(req, req.params.id));
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    const wanted = new Set(groupIds.map(String));
    const names = (await activeGroups(req)).filter((g) => wanted.has(String(g._id))).map((g) => g.name);
    await setGroupsByName(req, item, names);
    const [out] = await withGroups(req, [item]);
    res.json(out);
  } catch (error) {
    res.status(400).json({ message: "Importation impossible", details: error.message });
  }
});

router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  const item = await Rubric.findOneAndUpdate(mine(req, req.params.id, { archivedAt: null }), { $set: { archivedAt: new Date() } }, { new: true });
  if (!item) return res.status(404).json({ message: "Rubric introuvable ou déjà archivée" });
  res.json((await withGroups(req, [item]))[0]);
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  const item = await Rubric.findOneAndUpdate(mine(req, req.params.id), { $set: { archivedAt: null } }, { new: true });
  if (!item) return res.status(404).json({ message: "Rubric introuvable" });
  res.json((await withGroups(req, [item]))[0]);
});

/**
 * Duplique une grille (sans évaluations) pour la modifier sans toucher à l'original: dans le même cours, ou
 * dans un autre (`courseId`, ce qui l'importe d'un cours à l'autre). La copie repart en version 1.
 * Avec `replaceInGroups`, la copie prend la place de l'original dans les groupes de la session active.
 */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const src = await Rubric.findOne(mine(req, req.params.id));
    if (!src) return res.status(404).json({ message: "Rubric introuvable" });
    const course = await resolveCourse(req, req.body?.courseId === undefined ? src.course : req.body.courseId);
    const sameCourse = String(course) === String(src.course);
    const title = String(req.body?.title || "").trim() || (sameCourse ? `${src.title} (copie)` : src.title);
    const item = await Rubric.create({
      title,
      taskTitle: src.taskTitle,
      version: 1,
      isActive: true,
      linkCompetencies: src.linkCompetencies,
      criteria: src.criteria,
      feedbackMessages: src.feedbackMessages,
      course,
      createdBy: req.user._id,
    });
    if (req.body?.replaceInGroups === true) {
      for (const g of await activeGroups(req)) {
        if (!imported(g, src._id)) continue;
        await Group.updateOne({ _id: g._id }, { $addToSet: { rubrics: item._id, courses: item.course } });
        await Group.updateOne({ _id: g._id }, { $pull: { rubrics: src._id } });
      }
    }
    const [out] = await withGroups(req, [item]);
    res.status(201).json(out);
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  const deleted = await Rubric.findOneAndDelete(mine(req, req.params.id));
  if (!deleted) return res.status(404).json({ message: "Rubric introuvable" });
  await Group.updateMany({ createdBy: req.user._id, rubrics: deleted._id }, { $pull: { rubrics: deleted._id } });
  res.status(204).send();
});

module.exports = router;
