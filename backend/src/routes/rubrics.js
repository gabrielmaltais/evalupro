const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const Rubric = require("../models/Rubric");
const Course = require("../models/Course");
const Group = require("../models/Group");
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");
const { resolveActiveSession } = require("../services/sessionService");
const sessionCourses = require("../services/sessionCourseService");
const { alignCriteria } = require("../services/courseSync");
const { computeEvaluationTotals } = require("../utils/evaluationTotals");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");

const router = express.Router();

/**
 * Une grille est classée dans un cours; elle est utilisable en correction pour les groupes de la session active
 * qui suivent ce cours quand elle y est cochée (page Ma session). `groups` (noms) en est la vue.
 */
async function activeGroups(req) {
  const session = await resolveActiveSession(req.user);
  if (!session) return { session: null, groups: [] };
  return { session, groups: await Group.find({ createdBy: req.user._id, session: session._id, archivedAt: null }).sort({ name: 1 }) };
}

async function withGroups(req, rubrics) {
  const { session, groups } = await activeGroups(req);
  const usable = new Map(groups.map((g) => [String(g._id), new Set(sessionCourses.rubricIdsOf(session, g))]));
  return rubrics.map((r) => {
    const plain = r.toObject ? r.toObject() : r;
    const names = groups.filter((g) => usable.get(String(g._id)).has(String(plain._id))).map((g) => g.name);
    return { ...plain, groups: names, group: names[0] || "" };
  });
}

/**
 * Retire la grille des cours des sessions. Le filtre ne vise que les sessions qui la contiennent: `courses.$[]`
 * échoue (« path must exist ») sur une session ancienne qui n'a pas encore de champ `courses`.
 */
const pullFromSessions = (ownerId, rubricId, extra = {}) =>
  Session.updateMany({ createdBy: ownerId, "courses.rubrics": rubricId, ...extra }, { $pull: { "courses.$[].rubrics": rubricId } });

/** Aligne les liens de compétence de la grille sur son cours (voir alignCriteria) et l'enregistre au besoin. */
async function alignToCourse(req, rubric) {
  const course = await Course.findOne({ _id: rubric.course, createdBy: req.user._id }).select("competencies").lean();
  const { criteria, changed } = alignCriteria(rubric.criteria, course?.competencies);
  if (!changed) return rubric;
  rubric.criteria = criteria;
  return rubric.save();
}

const rubricSchema = z.object({
  title: z.string().min(1),
  taskTitle: z.string().min(1),
  version: z.number().int().min(1),
  isActive: z.boolean().optional(),
  linkCompetencies: z.boolean().optional(),
  course: z.string().min(1, "Choisis le cours dans lequel classer la grille"),
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
    const payload = rubricSchema.parse(req.body);
    const course = await resolveCourse(req, payload.course);
    const created = await Rubric.create({ ...payload, course, createdBy: req.user._id });
    const item = await alignToCourse(req, created);
    const [out] = await withGroups(req, [item]);
    res.status(201).json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.partial().parse(req.body);
    const course = await resolveCourse(req, payload.course);
    if (course !== undefined) payload.course = course;
    const before = await Rubric.findOne(mine(req, req.params.id)).select("course");
    let item = await Rubric.findOneAndUpdate(mine(req, req.params.id), payload, { new: true });
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    if (before && String(before.course) !== String(item.course)) {
      // Changer de cours: la grille quitte l'ancien cours des sessions (l'éditeur la remet dans le nouveau).
      await pullFromSessions(req.user._id, item._id);
    }
    if (payload.criteria || payload.course) item = await alignToCourse(req, item);
    if (payload.criteria) await recomputeEvaluationTotals(item);
    const [out] = await withGroups(req, [item]);
    res.json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
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
      // La copie prend la place de l'original dans la session active (et dans son cours, que les mêmes groupes suivent).
      const { session, groups } = await activeGroups(req);
      if (session && !session.archivedAt && sessionCourses.rubricIdsOf(session, { courses: groups.flatMap((g) => g.courses) }).includes(String(src._id))) {
        await sessionCourses.addRubrics(req.user._id, session._id, [item._id]);
        await pullFromSessions(req.user._id, src._id, { _id: session._id });
        const sameGroups = groups.filter((g) => sessionCourses.rubricIdsOf(session, g).includes(String(src._id)));
        await Group.updateMany({ _id: { $in: sameGroups.map((g) => g._id) } }, { $addToSet: { courses: item.course } });
      }
    }
    const [out] = await withGroups(req, [item]);
    res.status(201).json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.partial().parse(req.body);
    const course = await resolveCourse(req, payload.course);
    if (course !== undefined) payload.course = course;
    const before = await Rubric.findOne(mine(req, req.params.id)).select("course");
    let item = await Rubric.findOneAndUpdate(mine(req, req.params.id), payload, { new: true });
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    if (before && String(before.course) !== String(item.course)) {
      // Changer de cours: la grille quitte l'ancien cours des sessions (l'éditeur la remet dans le nouveau).
      await pullFromSessions(req.user._id, item._id);
    }
    if (payload.criteria || payload.course) item = await alignToCourse(req, item);
    if (payload.criteria) await recomputeEvaluationTotals(item);
    const [out] = await withGroups(req, [item]);
    res.json(out);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
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
        await sessionCourses.addRubrics(req.user._id, g.session, [item._id]);
        await pullFromSessions(req.user._id, src._id, { _id: g.session });
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
  await pullFromSessions(req.user._id, deleted._id);
  res.status(204).send();
});

module.exports = router;
