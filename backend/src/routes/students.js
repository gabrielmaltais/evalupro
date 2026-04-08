const express = require("express");
const { z } = require("zod");
const Student = require("../models/Student");
const Evaluation = require("../models/Evaluation");
const EvaluationEmailDelivery = require("../models/EvaluationEmailDelivery");
const { auth } = require("../middleware/auth");

const router = express.Router();

const studentSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  group: z.string().optional(),
});

router.use(auth);

router.get("/", async (req, res) => {
  // Only return students created by this user, or maybe all students?
  // Since it's a shared platform or personal, let's return students created by this user
  const items = await Student.find({ createdBy: req.user._id }).sort({ name: 1 });
  res.json(items);
});

router.get("/group-dashboard", async (req, res) => {
  const students = await Student.find({ createdBy: req.user._id }).lean();
  const studentIds = students.map((s) => s._id);
  const evaluations = await Evaluation.find({ owner: req.user._id, studentId: { $in: studentIds } })
    .select("studentId totalScore totalMax")
    .lean();
  const deliveries = await EvaluationEmailDelivery.find({ owner: req.user._id })
    .select("studentId status group")
    .lean();

  const byGroup = new Map();
  students.forEach((s) => {
    const g = s.group || "Sans groupe";
    if (!byGroup.has(g)) byGroup.set(g, { group: g, students: 0, evaluations: 0, avgPct: 0, sent: 0, failed: 0 });
    byGroup.get(g).students += 1;
  });

  const groupByStudent = new Map(students.map((s) => [String(s._id), s.group || "Sans groupe"]));
  let scoreAcc = {};
  evaluations.forEach((e) => {
    const g = groupByStudent.get(String(e.studentId)) || "Sans groupe";
    if (!byGroup.has(g)) byGroup.set(g, { group: g, students: 0, evaluations: 0, avgPct: 0, sent: 0, failed: 0 });
    byGroup.get(g).evaluations += 1;
    const pct = e.totalMax > 0 ? (Number(e.totalScore || 0) / Number(e.totalMax || 1)) * 100 : 0;
    if (!scoreAcc[g]) scoreAcc[g] = { sum: 0, n: 0 };
    scoreAcc[g].sum += pct;
    scoreAcc[g].n += 1;
  });

  deliveries.forEach((d) => {
    const g = d.group || groupByStudent.get(String(d.studentId)) || "Sans groupe";
    if (!byGroup.has(g)) byGroup.set(g, { group: g, students: 0, evaluations: 0, avgPct: 0, sent: 0, failed: 0 });
    if (d.status === "sent") byGroup.get(g).sent += 1;
    if (d.status === "failed") byGroup.get(g).failed += 1;
  });

  Array.from(byGroup.keys()).forEach((g) => {
    const acc = scoreAcc[g];
    byGroup.get(g).avgPct = acc?.n ? Number((acc.sum / acc.n).toFixed(1)) : 0;
  });

  res.json(Array.from(byGroup.values()).sort((a, b) => a.group.localeCompare(b.group)));
});

router.post("/", async (req, res) => {
  try {
    const payload = studentSchema.parse(req.body);
    const item = await Student.create({ ...payload, createdBy: req.user._id });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Etudiant invalide", details: error.message });
  }
});

const bulkStudentSchema = z.object({
  students: z.array(studentSchema)
});

router.post("/bulk", async (req, res) => {
  try {
    const payload = bulkStudentSchema.parse(req.body);
    const docs = payload.students.map(s => ({ ...s, createdBy: req.user._id }));
    const inserted = await Student.insertMany(docs);
    res.status(201).json(inserted);
  } catch (error) {
    res.status(400).json({ message: "Donnees invalides", details: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = studentSchema.partial().parse(req.body);
    const item = await Student.findOneAndUpdate({ _id: req.params.id, createdBy: req.user._id }, payload, { new: true });
    if (!item) return res.status(404).json({ message: "Etudiant introuvable" });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Etudiant invalide", details: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await Student.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
  if (!deleted) return res.status(404).json({ message: "Etudiant introuvable" });
  res.status(204).send();
});

router.post("/groups/rename", async (req, res) => {
  const schema = z.object({ from: z.string().min(1), to: z.string().min(1) });
  try {
    const { from, to } = schema.parse(req.body);
    const result = await Student.updateMany({ createdBy: req.user._id, group: from }, { $set: { group: to } });
    await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: from }, { $set: { group: to } });
    res.json({ modified: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ message: "Renommage de groupe invalide", details: error.message });
  }
});

router.post("/groups/merge", async (req, res) => {
  const schema = z.object({ fromGroups: z.array(z.string().min(1)).min(1), to: z.string().min(1) });
  try {
    const { fromGroups, to } = schema.parse(req.body);
    const result = await Student.updateMany({ createdBy: req.user._id, group: { $in: fromGroups } }, { $set: { group: to } });
    await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: { $in: fromGroups } }, { $set: { group: to } });
    res.json({ modified: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ message: "Fusion de groupes invalide", details: error.message });
  }
});

router.delete("/groups/:groupName", async (req, res) => {
  const groupName = decodeURIComponent(req.params.groupName);
  const result = await Student.updateMany({ createdBy: req.user._id, group: groupName }, { $set: { group: "" } });
  await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: groupName }, { $set: { group: "" } });
  res.json({ modified: result.modifiedCount });
});

module.exports = router;
