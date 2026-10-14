const express = require("express");
const { z } = require("zod");
const Course = require("../models/Course");
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
  const items = await Course.find(ownerFilter(req)).sort({ title: 1 });
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
    const update = {};
    if (payload.title !== undefined) update.title = payload.title;
    if (payload.code !== undefined) update.code = payload.code;
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
