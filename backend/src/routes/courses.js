const express = require("express");
const { z } = require("zod");
const Course = require("../models/Course");
const Rubric = require("../models/Rubric");
const Group = require("../models/Group");
const Session = require("../models/Session");
const { syncCourseRubrics } = require("../services/courseSync");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");
const { normalizeCompetencies } = require("../utils/courseCompetencies");

const router = express.Router();
router.use(auth);

const courseSchema = z.object({
  title: z.string().trim().min(1, "Le nom du cours est requis").max(200),
  code: z.string().trim().max(50).optional(),
  competencies: z
    .array(z.object({ id: z.string().optional(), title: z.string(), description: z.string().optional() }))
    .max(100)
    .optional(),
});

function ownerFilter(req, extra = {}) {
  return { ...extra, createdBy: req.user._id };
}

router.get("/", async (req, res) => {
  const archived = req.query.archived === "1" || req.query.archived === "true";
  const items = await Course.find(ownerFilter(req, { archivedAt: archived ? { $ne: null } : null })).sort({ title: 1 });
  res.json(items);
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = courseSchema.parse(req.body);
    const item = await Course.create({
      title: payload.title,
      code: payload.code || "",
      competencies: normalizeCompetencies(payload.competencies),
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Cours invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = courseSchema.partial().parse(req.body);
    const item = await Course.findOne(ownerFilter(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Cours introuvable" });
    const before = (item.competencies || []).map((c) => ({ id: c.id, title: c.title, description: c.description }));
    if (payload.title !== undefined) item.title = payload.title;
    if (payload.code !== undefined) item.code = payload.code;
    if (payload.competencies !== undefined) item.competencies = normalizeCompetencies(payload.competencies);
    await item.save();
    // Les grilles du cours qui n'ont pas encore servi suivent les compétences modifiées.
    const sync =
      payload.competencies !== undefined
        ? await syncCourseRubrics(req.user._id, item._id, before, item.competencies.map((c) => ({ id: c.id, title: c.title })))
        : { updated: 0, skipped: 0 };
    res.json({ ...item.toObject(), sync });
  } catch (error) {
    res.status(400).json({ message: "Cours invalide", details: error.message });
  }
});

/** Archiver un cours (action explicite) range aussi ses grilles actives; restaurer remet celles qu'il avait rangées. */
router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  const when = new Date();
  const item = await Course.findOneAndUpdate(
    ownerFilter(req, { _id: req.params.id, archivedAt: null }),
    { $set: { archivedAt: when } },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Cours introuvable ou déjà archivé" });
  const r = await Rubric.updateMany({ course: item._id, archivedAt: null }, { $set: { archivedAt: when } });
  res.json({ ...item.toObject(), archivedRubrics: r.modifiedCount });
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  const before = await Course.findOne(ownerFilter(req, { _id: req.params.id }));
  if (!before) return res.status(404).json({ message: "Cours introuvable" });
  const when = before.archivedAt;
  before.archivedAt = null;
  await before.save();
  const r = when ? await Rubric.updateMany({ course: before._id, archivedAt: when }, { $set: { archivedAt: null } }) : { modifiedCount: 0 };
  res.json({ ...before.toObject(), restoredRubrics: r.modifiedCount });
});

/** Copie un cours (avec ses compétences). */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const src = await Course.findOne(ownerFilter(req, { _id: req.params.id }));
    if (!src) return res.status(404).json({ message: "Cours introuvable" });
    const item = await Course.create({
      title: src.title,
      code: src.code,
      competencies: src.competencies,
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

/** Supprime un cours vide; s'il contient des grilles, il faut d'abord les déplacer ou les supprimer (ou archiver le cours). */
router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const course = await Course.findOne(ownerFilter(req, { _id: req.params.id }));
    if (!course) return res.status(404).json({ message: "Cours introuvable" });
    const rubrics = await Rubric.countDocuments({ course: course._id });
    if (rubrics > 0) {
      return res.status(409).json({
        message: "Ce cours contient encore des grilles: déplace-les ou supprime-les d'abord, ou archive le cours.",
        rubrics,
      });
    }
    await course.deleteOne();
    await Session.updateMany({ createdBy: req.user._id, "courses.course": course._id }, { $pull: { courses: { course: course._id } } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Suppression invalide", details: error.message });
  }
});

module.exports = router;
