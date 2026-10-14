const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const Rubric = require("../models/Rubric");
const Session = require("../models/Session");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");

const router = express.Router();

function normalizeGroupsInput(groups, group) {
  if (groups !== undefined) {
    const normalized = Array.from(
      new Set((Array.isArray(groups) ? groups : [groups]).map((g) => String(g || "").trim()).filter(Boolean))
    );
    return { groups: normalized, group: normalized[0] || "" };
  }
  if (group !== undefined) {
    const g = String(group || "").trim();
    return { groups: g ? [g] : [], group: g };
  }
  return null;
}

const rubricSchema = z.object({
  title: z.string().min(1),
  taskTitle: z.string().min(1),
  version: z.number().int().min(1),
  isActive: z.boolean().optional(),
  linkCompetencies: z.boolean().optional(),
  group: z.string().optional(),
  groups: z.array(z.string()).optional(),
  session: z.string().nullable().optional(),
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      competencyElement: z.string().optional(),
      weight: z.number().nonnegative(),
      color: z.string().optional(),
      levels: z.array(z.object({ label: z.string(), maxPct: z.number().min(0).max(1), minPct: z.number().min(0).max(1).optional(), desc: z.string() })).optional(),
      subCriteria: z.array(z.object({ id: z.string(), label: z.string(), pts: z.number(), feedback: z.string().optional() })).optional(),
    })
  ),
  feedbackMessages: z.array(z.object({ minPct: z.number(), maxPct: z.number(), message: z.string() })).optional(),
});

router.use(auth);

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
  const items = await Rubric.find({ archivedAt: archived ? { $ne: null } : null }).sort({ createdAt: -1 });
  res.json(items);
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.parse(req.body);
    const normalizedGroupData = normalizeGroupsInput(payload.groups, payload.group);
    if (normalizedGroupData) {
      payload.groups = normalizedGroupData.groups;
      payload.group = normalizedGroupData.group;
    }
    const session = await resolveSession(req, payload.session);
    const item = await Rubric.create({ ...payload, session: session || null, createdBy: req.user._id });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = rubricSchema.partial().parse(req.body);
    const normalizedGroupData = normalizeGroupsInput(payload.groups, payload.group);
    if (normalizedGroupData) {
      payload.groups = normalizedGroupData.groups;
      payload.group = normalizedGroupData.group;
    }
    const session = await resolveSession(req, payload.session);
    if (session !== undefined) payload.session = session;
    const item = await Rubric.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!item) return res.status(404).json({ message: "Rubric introuvable" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Rubric invalide", details: error.message });
  }
});

router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  const item = await Rubric.findOneAndUpdate({ _id: req.params.id, archivedAt: null }, { $set: { archivedAt: new Date() } }, { new: true });
  if (!item) return res.status(404).json({ message: "Rubric introuvable ou déjà archivée" });
  res.json(item);
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  const item = await Rubric.findByIdAndUpdate(req.params.id, { $set: { archivedAt: null } }, { new: true });
  if (!item) return res.status(404).json({ message: "Rubric introuvable" });
  res.json(item);
});

/**
 * Copie une grille (sans évaluations) vers de nouveaux groupes, éventuellement dans une session.
 * La copie repart en version 1; les évaluations restent liées à l'original.
 */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const src = await Rubric.findById(req.params.id);
    if (!src) return res.status(404).json({ message: "Rubric introuvable" });
    const session = await resolveSession(req, req.body?.sessionId);
    const g = normalizeGroupsInput(Array.isArray(req.body?.groups) ? req.body.groups : [], undefined);
    const title = String(req.body?.title || "").trim() || src.title;
    const item = await Rubric.create({
      title,
      taskTitle: src.taskTitle,
      version: 1,
      isActive: true,
      linkCompetencies: src.linkCompetencies,
      criteria: src.criteria,
      feedbackMessages: src.feedbackMessages,
      groups: g.groups,
      group: g.group,
      session: session || null,
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  const deleted = await Rubric.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Rubric introuvable" });
  res.status(204).send();
});

module.exports = router;
