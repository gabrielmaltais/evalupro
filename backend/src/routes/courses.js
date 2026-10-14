const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Session = require("../models/Session");
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
  session: z.string().nullable().optional(),
});

function ownerFilter(req, extra = {}) {
  return { ...extra, createdBy: req.user._id };
}

/** Vérifie que la session appartient à l'utilisateur; retourne l'id, null, ou undefined si non fournie. */
async function resolveSession(req, value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (!mongoose.isValidObjectId(value)) throw new Error("Session invalide");
  const s = await Session.findOne({ _id: value, createdBy: req.user._id }).select("_id");
  if (!s) throw new Error("Session introuvable");
  return s._id;
}

router.get("/", async (req, res) => {
  const archived = req.query.archived === "1" || req.query.archived === "true";
  const items = await Course.find(ownerFilter(req, { archivedAt: archived ? { $ne: null } : null })).sort({ title: 1 });
  res.json(items);
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = courseSchema.parse(req.body);
    const session = await resolveSession(req, payload.session);
    const item = await Course.create({
      session: session || null,
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
    const update = {};
    if (payload.title !== undefined) update.title = payload.title;
    if (payload.code !== undefined) update.code = payload.code;
    const session = await resolveSession(req, payload.session);
    if (session !== undefined) update.session = session;
    if (payload.competencies !== undefined) update.competencies = normalizeCompetencies(payload.competencies);
    const item = await Course.findOneAndUpdate(ownerFilter(req, { _id: req.params.id }), update, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ message: "Cours introuvable" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Cours invalide", details: error.message });
  }
});

router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  const item = await Course.findOneAndUpdate(
    ownerFilter(req, { _id: req.params.id, archivedAt: null }),
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Cours introuvable ou déjà archivé" });
  res.json(item);
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  const item = await Course.findOneAndUpdate(
    ownerFilter(req, { _id: req.params.id }),
    { $set: { archivedAt: null } },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Cours introuvable" });
  res.json(item);
});

/** Copie un cours (avec ses compétences) dans une session, ou sans session si sessionId est absent. */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const src = await Course.findOne(ownerFilter(req, { _id: req.params.id }));
    if (!src) return res.status(404).json({ message: "Cours introuvable" });
    const session = await resolveSession(req, req.body?.sessionId);
    const item = await Course.create({
      title: src.title,
      code: src.code,
      competencies: src.competencies,
      session: session || null,
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const deleted = await Course.findOneAndDelete(ownerFilter(req, { _id: req.params.id }));
    if (!deleted) return res.status(404).json({ message: "Cours introuvable" });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Suppression invalide", details: error.message });
  }
});

module.exports = router;
