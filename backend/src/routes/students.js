const express = require("express");
const { z } = require("zod");
const Student = require("../models/Student");
const auth = require("../middleware/auth");

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

module.exports = router;
