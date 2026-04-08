const express = require("express");
const { z } = require("zod");
const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");
const { auth } = require("../middleware/auth");
const { generateSummary } = require("../services/gemini");

const router = express.Router();
router.use(auth);

const schema = z.object({
  studentName: z.string().min(1),
  studentId: z.string().optional(),
  date: z.string().min(1),
  scores: z.any().optional(),
  subScores: z.any().optional(),
  comments: z.any().optional(),
  generalComment: z.string().optional(),
  rubric: z.string().min(1),
  generateAiSummary: z.boolean().optional(),
});

router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const query = req.user.role === "admin" ? {} : { owner: req.user._id };
  if (req.query.studentName) query.studentName = new RegExp(req.query.studentName, "i");
  if (req.query.studentId) query.studentId = req.query.studentId;
  const [items, total] = await Promise.all([
    Evaluation.find(query).populate("rubric", "title version").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Evaluation.countDocuments(query),
  ]);
  res.json({ items, page, limit, total });
});

router.post("/", async (req, res) => {
  try {
    const payload = schema.parse(req.body);
    const rubric = await Rubric.findById(payload.rubric);
    if (!rubric) return res.status(404).json({ message: "Rubric introuvable" });
    const totalScore = Object.values(payload.scores || {}).reduce((a, b) => a + Number(b), 0);
    const totalMax = rubric.criteria.reduce((sum, c) => sum + Number(c.weight), 0);
    let aiSummary = "";
    if (payload.generateAiSummary) {
      aiSummary = await generateSummary(`Etudiant: ${payload.studentName}\nCommentaire: ${payload.generalComment || ""}`);
    }
    const createData = { ...payload, aiSummary, totalScore, totalMax, owner: req.user._id };
    if (!createData.studentId) {
      delete createData.studentId;
    }
    const item = await Evaluation.create(createData);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Evaluation invalide", details: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const item = await Evaluation.findById(req.params.id).populate("rubric");
  if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
  if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
  res.json(item);
});

router.put("/:id", async (req, res) => {
  const item = await Evaluation.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
  if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
  const payload = schema.partial().parse(req.body);
  if (payload.studentId === "") {
    payload.studentId = undefined; // Force unsetting or ignoring
    item.studentId = undefined;
  }
  Object.assign(item, payload);
  await item.save();
  res.json(item);
});

router.delete("/:id", async (req, res) => {
  const item = await Evaluation.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
  if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
  await item.deleteOne();
  res.status(204).send();
});

module.exports = router;
