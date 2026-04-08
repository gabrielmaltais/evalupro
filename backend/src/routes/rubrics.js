const express = require("express");
const { z } = require("zod");
const Rubric = require("../models/Rubric");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");

const router = express.Router();

const rubricSchema = z.object({
  title: z.string().min(1),
  taskTitle: z.string().min(1),
  version: z.number().int().min(1),
  isActive: z.boolean().optional(),
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      weight: z.number().nonnegative(),
      color: z.string().optional(),
      levels: z.array(z.object({ label: z.string(), maxPct: z.number().min(0).max(1), desc: z.string() })).optional(),
      subCriteria: z.array(z.object({ id: z.string(), label: z.string(), pts: z.number(), feedback: z.string().optional() })).optional(),
    })
  ),
  feedbackMessages: z.array(z.object({ minPct: z.number(), maxPct: z.number(), message: z.string() })).optional(),
});

router.use(auth);

router.get("/", async (_req, res) => {
  const items = await Rubric.find().sort({ createdAt: -1 });
  res.json(items);
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.parse(req.body);
    if (payload.isActive) await Rubric.updateMany({}, { isActive: false });
    const item = await Rubric.create({ ...payload, createdBy: req.user._id });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.partial().parse(req.body);
    if (payload.isActive) await Rubric.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    const item = await Rubric.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  const deleted = await Rubric.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Rubric introuvable" });
  res.status(204).send();
});

module.exports = router;
