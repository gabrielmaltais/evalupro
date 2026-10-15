const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");
const EvaluationEmailDelivery = require("../models/EvaluationEmailDelivery");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const { auth } = require("../middleware/auth");
const { generateSummary } = require("../services/gemini");
const { startBatchJob, getProgress, sendOneEvaluationEmail } = require("../services/emailBatchService");
const { createEvaluationPdfBuffer, getEvaluationPdfFileName } = require("../services/evaluationPdfService");
const { studentFullNameFromDoc } = require("../utils/studentName");
const { computeEvaluationTotals } = require("../utils/evaluationTotals");
const { resolveActiveSession } = require("../services/sessionService");
const { studentsOfGroup } = require("../services/groupService");

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

/**
 * Contexte d'une note: la session (celle de l'évaluation, sinon la session active) et le groupe dans lequel
 * l'élève y est inscrit. Conservé tel quel même si l'élève change de groupe plus tard.
 */
async function evaluationContext(user, studentId, sessionId) {
  const session = sessionId || (await resolveActiveSession(user))?._id || null;
  let group = null;
  if (session && studentId) {
    const e = await Enrollment.findOne({ student: studentId, session }).select("group").lean();
    group = e?.group || null;
  }
  return { session, group };
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(req.query.limit)) || 10));
  // Données isolées par utilisateur: chacun ne voit que ses évaluations (administrateur compris).
  const query = { owner: req.user._id };
  if (req.query.studentName) query.studentName = new RegExp(escapeRegex(req.query.studentName), "i");
  if (req.query.studentId) query.studentId = req.query.studentId;
  // Par défaut: évaluations de la session active (et celles sans session). L'historique d'un élève, ou
  // `session=all`, couvre toutes les sessions; `session=<id>` en cible une.
  if (!req.query.studentId && req.query.session !== "all") {
    if (req.query.session && mongoose.isValidObjectId(req.query.session)) {
      query.session = req.query.session;
    } else {
      const active = await resolveActiveSession(req.user);
      query.$or = [{ session: null }, ...(active ? [{ session: active._id }] : [])];
    }
  }
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
    const rubric = await Rubric.findOne({ _id: payload.rubric, createdBy: req.user._id });
    if (!rubric) return res.status(404).json({ message: "Rubric introuvable" });
    const { totalScore, totalMax } = computeEvaluationTotals(rubric, payload.scores);
    let aiSummary = "";
    if (payload.generateAiSummary) {
      aiSummary = await generateSummary(`Etudiant: ${payload.studentName}\nCommentaire: ${payload.generalComment || ""}`);
    }
    const createData = { ...payload, aiSummary, totalScore, totalMax, owner: req.user._id };
    if (!createData.studentId) {
      delete createData.studentId;
    }
    Object.assign(createData, await evaluationContext(req.user, createData.studentId));
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
  const active = await resolveActiveSession(req.user);
  // Seulement les copies de la session en cours (celles d'avant les sessions n'y sont plus mêlées).
  const query = { owner: req.user._id, session: active ? active._id : null };
  const imported = new Set((active?.courses || []).flatMap((c) => c.rubrics.map(String)));
  const [groups, rubrics] = await Promise.all([
    active
      ? Group.find({ createdBy: req.user._id, session: active._id, archivedAt: null }).distinct("name")
      : [],
    Evaluation.find(query).populate("rubric", "title taskTitle version archivedAt").sort({ createdAt: -1 }),
  ]);
  const examMap = new Map();
  rubrics.forEach((ev) => {
    if (!ev.rubric || ev.rubric.archivedAt) return;
    const key = String(ev.rubric._id);
    if (!examMap.has(key)) {
      examMap.set(key, {
        rubricId: key,
        title: ev.rubric.title,
        taskTitle: ev.rubric.taskTitle,
        version: ev.rubric.version,
        // Décochée dans la session mais déjà corrigée: reste visible pour le suivi et l'envoi.
        retired: !imported.has(key),
      });
    }
  });
  res.json({ groups: groups.sort(), exams: Array.from(examMap.values()) });
});

router.post("/email-batches", async (req, res) => {
  try {
    const payload = batchSchema.parse(req.body);
    const active = await resolveActiveSession(req.user);
    const group = active
      ? await Group.findOne({ createdBy: req.user._id, session: active._id, name: payload.group })
      : null;
    if (!group) return res.status(404).json({ message: "Groupe introuvable dans la session active" });
    const jobId = startBatchJob({
      owner: req.user,
      group: group.name,
      groupId: group._id,
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
    .populate("studentId", "name firstName lastName email")
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
      .populate("evaluationId", "rubric");

    if (!failed.length) return res.json({ message: "Aucune erreur a relancer", jobId: null });

    const firstEval = failed[0].evaluationId;
    if (!firstEval?.rubric) {
      return res.status(400).json({ message: "Relance impossible: donnees incompletes" });
    }
    const active = await resolveActiveSession(req.user);
    const groupDoc = active
      ? await Group.findOne({ createdBy: req.user._id, session: active._id, name: failed[0].group })
      : null;
    if (!groupDoc) return res.status(400).json({ message: "Relance impossible: le groupe n'existe plus dans la session active" });
    const jobId = startBatchJob({
      owner: req.user,
      group: groupDoc.name,
      groupId: groupDoc._id,
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

router.get("/:id/pdf", async (req, res) => {
  try {
    const item = await Evaluation.findById(req.params.id).populate("rubric");
    if (!item) return res.status(404).json({ message: "Evaluation introuvable" });
    if (req.user.role !== "admin" && item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Acces refuse" });
    }
    if (!item.rubric) return res.status(400).json({ message: "Rubric introuvable pour cette evaluation" });

    const pdfBuffer = await createEvaluationPdfBuffer(item, item.rubric);
    const filename = getEvaluationPdfFileName(item, item.rubric);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(400).json({ message: "Generation PDF impossible", details: error.message });
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
      const rubricExists = await Rubric.findOne({ _id: item.rubric, createdBy: req.user._id }).select("_id criteria");
      if (!rubricExists) return res.status(404).json({ message: "Rubric introuvable" });
    }

    // Recalcul des totaux à chaque modification (notes ou grille) pour garder suivi et envois synchronisés.
    const rubricForTotals = await Rubric.findById(item.rubric).select("criteria");
    const totals = computeEvaluationTotals(
      rubricForTotals,
      Object.prototype.hasOwnProperty.call(payload, "scores") ? payload.scores : item.scores
    );
    item.totalScore = totals.totalScore;
    item.totalMax = totals.totalMax;

    if (item.studentId) {
      const st = await Student.findOne({ _id: item.studentId, createdBy: req.user._id }).lean();
      if (st) item.studentName = studentFullNameFromDoc(st);
    }
    // L'élève a changé: la note suit son inscription dans la session de l'évaluation.
    if (Object.prototype.hasOwnProperty.call(payload, "studentId") && item.studentId) {
      Object.assign(item, await evaluationContext(req.user, item.studentId, item.session));
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
