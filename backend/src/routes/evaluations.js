const express = require("express");
const { z } = require("zod");
const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");
const EvaluationEmailDelivery = require("../models/EvaluationEmailDelivery");
const Student = require("../models/Student");
const { auth } = require("../middleware/auth");
const { generateSummary } = require("../services/gemini");
const { startBatchJob, getProgress, sendOneEvaluationEmail } = require("../services/emailBatchService");
const { studentFullNameFromDoc } = require("../utils/studentName");

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
  // Optionnels: ne doivent jamais bloquer l’enregistrement d’une évaluation.
  markerColor: z.string().optional(),
  markerIcon: z.string().optional(),
});

function normalizeMarkerColor(raw) {
  if (raw == null) return "";
  const v = String(raw).trim();
  if (!v) return "";
  // Supporte "#rrggbb", "#rgb" ou "rrggbb"/"rgb"
  const noHash = v.startsWith("#") ? v.slice(1) : v;
  if (/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(noHash)) return `#${noHash}`;
  return "";
}

function normalizeMarkerIcon(raw) {
  if (raw == null) return "";
  return String(raw).trim().slice(0, 80);
}

router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const query = req.user.role === "admin" ? {} : { owner: req.user._id };
  if (req.query.studentName) query.studentName = new RegExp(req.query.studentName, "i");
  if (req.query.studentId) query.studentId = req.query.studentId;
  const [items, total] = await Promise.all([
    Evaluation.find(query).populate("rubric", "title taskTitle version").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Evaluation.countDocuments(query),
  ]);
  res.json({ items, page, limit, total });
});

router.post("/", async (req, res) => {
  try {
    const payload = schema.parse(req.body);
    payload.markerColor = normalizeMarkerColor(payload.markerColor);
    payload.markerIcon = normalizeMarkerIcon(payload.markerIcon);
    if (payload.studentId) {
      const st = await Student.findOne({ _id: payload.studentId, createdBy: req.user._id }).lean();
      if (st) payload.studentName = studentFullNameFromDoc(st);
    }
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

const batchSchema = z.object({
  group: z.string().min(1),
  rubricId: z.string().min(1),
  skipAlreadySent: z.boolean().optional(),
  allowResendFailed: z.boolean().optional(),
  delayMs: z.number().int().min(0).max(10000).optional(),
});

const sendOneSchema = z.object({
  evaluationId: z.string().min(1),
  resend: z.boolean().optional(),
});

router.get("/email-targets", async (req, res) => {
  const query = req.user.role === "admin" ? {} : { owner: req.user._id };
  const [groups, rubrics] = await Promise.all([
    Student.find({ createdBy: req.user._id, group: { $nin: [null, ""] } }).distinct("group"),
    Evaluation.find(query).populate("rubric", "title taskTitle version").sort({ createdAt: -1 }),
  ]);
  const examMap = new Map();
  rubrics.forEach((ev) => {
    if (!ev.rubric) return;
    const key = String(ev.rubric._id);
    if (!examMap.has(key)) {
      examMap.set(key, {
        rubricId: key,
        title: ev.rubric.title,
        taskTitle: ev.rubric.taskTitle,
        version: ev.rubric.version,
      });
    }
  });
  res.json({ groups: groups.sort(), exams: Array.from(examMap.values()) });
});

router.post("/email-batches", async (req, res) => {
  try {
    const payload = batchSchema.parse(req.body);
    const jobId = startBatchJob({
      owner: req.user,
      group: payload.group,
      rubricId: payload.rubricId,
      skipAlreadySent: payload.skipAlreadySent !== false,
      allowResendFailed: payload.allowResendFailed !== false,
      delayMs: payload.delayMs,
    });
    res.status(202).json({ jobId });
  } catch (error) {
    res.status(400).json({ message: "Demarrage du lot impossible", details: error.message });
  }
});

router.post("/email-send-one", async (req, res) => {
  try {
    const body = sendOneSchema.parse(req.body);
    const result = await sendOneEvaluationEmail({
      owner: req.user,
      evaluationId: body.evaluationId,
      resend: body.resend === true,
    });
    if (result.alreadySent) return res.json({ ok: true, alreadySent: true, delivery: result.delivery });
    res.json({ ok: true, sent: true, delivery: result.delivery });
  } catch (error) {
    const code = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
    res.status(code).json({ message: error.message || String(error) });
  }
});

router.get("/email-batches/:jobId", async (req, res) => {
  const progress = getProgress(req.params.jobId);
  if (!progress) return res.status(404).json({ message: "Job introuvable" });
  res.json(progress);
});

router.get("/email-deliveries", async (req, res) => {
  const query = req.user.role === "admin" ? {} : { owner: req.user._id };
  if (req.query.status) query.status = req.query.status;
  if (req.query.group) query.group = req.query.group;
  if (req.query.examKey) query.examKey = req.query.examKey;

  const items = await EvaluationEmailDelivery.find(query)
    .populate({
      path: "evaluationId",
      select: "studentName date rubric",
      populate: { path: "rubric", select: "title taskTitle version" },
    })
    .populate("studentId", "name firstName lastName email group")
    .sort({ updatedAt: -1 })
    .limit(300);
  res.json(items);
});

router.post("/email-batches/:jobId/retry-failed", async (req, res) => {
  try {
    const failed = await EvaluationEmailDelivery.find({
      owner: req.user._id,
      jobId: req.params.jobId,
      status: "failed",
    })
      .populate("evaluationId", "rubric")
      .populate("studentId", "group");

    if (!failed.length) return res.json({ message: "Aucune erreur a relancer", jobId: null });

    const firstEval = failed[0].evaluationId;
    if (!firstEval?.rubric) {
      return res.status(400).json({ message: "Relance impossible: donnees incompletes" });
    }
    const group = failed[0].group || failed[0].studentId?.group || "";
    const jobId = startBatchJob({
      owner: req.user,
      group,
      rubricId: String(firstEval.rubric),
      skipAlreadySent: true,
      allowResendFailed: true,
      delayMs: Number(req.body?.delayMs || 700),
    });
    res.status(202).json({ jobId });
  } catch (error) {
    res.status(400).json({ message: "Relance impossible", details: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await Evaluation.findById(req.params.id).populate("rubric");
    if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
    if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Identifiant evaluation invalide", details: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const item = await Evaluation.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
    if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
    const payload = schema.partial().parse(req.body);
    if (Object.prototype.hasOwnProperty.call(payload, "markerColor")) payload.markerColor = normalizeMarkerColor(payload.markerColor);
    if (Object.prototype.hasOwnProperty.call(payload, "markerIcon")) payload.markerIcon = normalizeMarkerIcon(payload.markerIcon);
    if (payload.studentId === "") {
      payload.studentId = undefined; // Force unsetting or ignoring
      item.studentId = undefined;
    }
    Object.assign(item, payload);
    if (payload.rubric) {
      const rubricExists = await Rubric.findById(item.rubric).select("_id criteria");
      if (!rubricExists) return res.status(404).json({ message: "Rubric introuvable" });
    }

    // Recalcul des totaux après modification pour garder le suivi/envois synchronisés.
    const nextScores = item.scores ? Object.values(item.scores.toObject?.() || item.scores || {}) : [];
    item.totalScore = nextScores.reduce((sum, v) => sum + Number(v || 0), 0);
    const rubricForTotals = await Rubric.findById(item.rubric).select("criteria");
    item.totalMax = (rubricForTotals?.criteria || []).reduce((sum, c) => sum + Number(c.weight || 0), 0);

    if (item.studentId) {
      const st = await Student.findOne({ _id: item.studentId, createdBy: req.user._id }).lean();
      if (st) item.studentName = studentFullNameFromDoc(st);
    }
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Mise a jour invalide", details: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const item = await Evaluation.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
    if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Acces refuse" });
    await item.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Suppression invalide", details: error.message });
  }
});

module.exports = router;
