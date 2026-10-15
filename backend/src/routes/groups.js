const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Course = require("../models/Course");
const Rubric = require("../models/Rubric");
const Student = require("../models/Student");
const Session = require("../models/Session");
const Enrollment = require("../models/Enrollment");
const Evaluation = require("../models/Evaluation");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");
const { normalizeStudentPayload } = require("../utils/studentName");
const { resolveActiveSession } = require("../services/sessionService");
const sessionCourses = require("../services/sessionCourseService");
const { enrollStudent, unenrollStudent, availableRubrics, importRubrics, httpError, isId } = require("../services/groupService");

const router = express.Router();
router.use(auth);

const hex = z.string().trim().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Couleur hex invalide");

const groupSchema = z.object({
  name: z.string().trim().min(1, "Le nom du groupe est requis").max(120),
  session: z.string().optional(),
  courses: z.array(z.string()).optional(),
  /** Grilles importées dans le groupe (leur cours est relié au passage). */
  rubrics: z.array(z.string()).optional(),
  color: z.union([hex, z.literal("")]).optional(),
  icon: z.string().trim().max(80).optional(),
});

const mine = (req, extra = {}) => ({ ...extra, createdBy: req.user._id });

function sendError(res, error, fallback) {
  const code = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
  const duplicate = error.code === 11000;
  if (duplicate) return res.status(409).json({ message: "Un groupe porte déjà ce nom dans cette session." });
  res.status(code).json(code === 400 ? { message: fallback, details: error.message } : { message: error.message });
}

/** Session demandée (`?session=<id>`), sinon la session active. */
async function targetSession(req, value) {
  if (value && value !== "active") {
    if (!isId(value)) throw httpError(400, "Session invalide");
    const s = await Session.findOne(mine(req, { _id: value }));
    if (!s) throw httpError(404, "Session introuvable");
    return s;
  }
  const active = await resolveActiveSession(req.user);
  if (!active) throw httpError(409, "Crée d'abord une session pour y placer des groupes.");
  return active;
}

/** Garde seulement les ids de ressources qui appartiennent à l'utilisateur. */
async function ownedIds(Model, req, ids) {
  const valid = (ids || []).filter(isId);
  if (!valid.length) return [];
  return Model.find(mine(req, { _id: { $in: valid } })).distinct("_id");
}

async function present(req, groups) {
  const list = groups.map((g) => (g.toObject ? g.toObject() : g));
  const ids = list.map((g) => g._id);
  const [students, evaluations, courses, rubrics] = await Promise.all([
    Enrollment.aggregate([{ $match: { group: { $in: ids }, archivedAt: null } }, { $group: { _id: "$group", n: { $sum: 1 } } }]),
    Evaluation.aggregate([{ $match: { owner: req.user._id, group: { $in: ids } } }, { $group: { _id: "$group", n: { $sum: 1 } } }]),
    Course.find(mine(req, { _id: { $in: list.flatMap((g) => g.courses || []) } })).select("title code archivedAt").lean(),
    Rubric.find(mine(req, { _id: { $in: list.flatMap((g) => g.rubrics || []) } }))
      .select("title taskTitle course archivedAt")
      .lean(),
  ]);
  const count = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const sc = count(students);
  const ec = count(evaluations);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const rubricById = new Map(rubrics.map((r) => [String(r._id), r]));
  return list.map((g) => {
    const imported = (g.rubrics || []).map((id) => rubricById.get(String(id))).filter(Boolean);
    return {
      ...g,
      rubricList: imported,
      studentCount: sc.get(String(g._id)) || 0,
      evaluationCount: ec.get(String(g._id)) || 0,
      courseList: (g.courses || []).map((id) => courseById.get(String(id))).filter(Boolean),
      availableRubricCount: imported.filter((r) => !r.archivedAt).length,
    };
  });
}

router.get("/", async (req, res) => {
  try {
    const archived = req.query.archived === "1" || req.query.archived === "true";
    const filter = mine(req, { archivedAt: archived ? { $ne: null } : null });
    if (req.query.session === "all") {
      // Toutes les sessions (page d'archives).
    } else {
      filter.session = (await targetSession(req, req.query.session))._id;
    }
    const groups = await Group.find(filter).sort({ name: 1 });
    res.json(await present(req, groups));
  } catch (error) {
    sendError(res, error, "Chargement des groupes impossible");
  }
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = groupSchema.parse(req.body);
    const session = await targetSession(req, payload.session);
    if (session.archivedAt) throw httpError(409, "Cette session est archivée.");
    const item = await Group.create({
      name: payload.name,
      session: session._id,
      courses: await ownedIds(Course, req, payload.courses),
      color: payload.color || "",
      icon: payload.icon || "",
      createdBy: req.user._id,
    });
    if (payload.rubrics?.length) await importRubrics(req.user._id, item, payload.rubrics);
    await sessionCourses.ensureCoursesInSession(req.user._id, await Session.findById(session._id), item.courses);
    res.status(201).json((await present(req, [await Group.findById(item._id)]))[0]);
  } catch (error) {
    sendError(res, error, "Groupe invalide");
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = groupSchema.omit({ session: true }).partial().parse(req.body);
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    if (payload.name !== undefined) group.name = payload.name;
    if (payload.color !== undefined) group.color = payload.color;
    if (payload.icon !== undefined) group.icon = payload.icon;
    if (payload.courses !== undefined) {
      group.courses = await ownedIds(Course, req, payload.courses);
      // Un cours retiré emporte les grilles qui en avaient été importées.
      const keep = new Set(group.courses.map(String));
      const imported = await Rubric.find(mine(req, { _id: { $in: group.rubrics } })).select("course").lean();
      const drop = new Set(imported.filter((r) => !keep.has(String(r.course))).map((r) => String(r._id)));
      group.rubrics = group.rubrics.filter((id) => !drop.has(String(id)));
    }
    await group.save();
    if (payload.courses !== undefined) {
      const session = await Session.findOne(mine(req, { _id: group.session }));
      if (session && !session.archivedAt) await sessionCourses.ensureCoursesInSession(req.user._id, session, group.courses);
    }
    if (payload.rubrics !== undefined) {
      // Remplace la sélection de grilles: on retire d'abord ce qui n'est plus voulu, puis on importe.
      const wanted = new Set(payload.rubrics.map(String));
      await Group.updateOne({ _id: group._id }, { $pull: { rubrics: { $nin: Array.from(wanted).filter(isId) } } });
      await importRubrics(req.user._id, group, payload.rubrics);
    }
    res.json((await present(req, [await Group.findById(group._id)]))[0]);
  } catch (error) {
    sendError(res, error, "Groupe invalide");
  }
});

/** Détail d'un groupe: élèves inscrits et grilles utilisables en correction (avec leur cours). */
router.get("/:id", async (req, res) => {
  try {
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    const enrollments = await Enrollment.find({ group: group._id }).lean();
    const students = await Student.find({ _id: { $in: enrollments.map((e) => e.student) } }).sort({ lastName: 1, firstName: 1, name: 1 }).lean();
    const rubrics = await availableRubrics(req.user._id, group);
    res.json({ ...(await present(req, [group]))[0], students, rubrics });
  } catch (error) {
    sendError(res, error, "Groupe introuvable");
  }
});

/** Grilles utilisables en correction pour ce groupe. */
router.get("/:id/rubrics", async (req, res) => {
  try {
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    res.json(await availableRubrics(req.user._id, group));
  } catch (error) {
    sendError(res, error, "Chargement des grilles impossible");
  }
});

/** Importe des grilles dans le groupe, à tout moment de la session (relie leur cours au passage). */
router.post("/:id/rubrics", roles("admin", "teacher"), async (req, res) => {
  try {
    const { rubricIds } = z.object({ rubricIds: z.array(z.string()).min(1) }).parse(req.body);
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    const added = await importRubrics(req.user._id, group, rubricIds);
    res.json({ added, group: (await present(req, [await Group.findById(group._id)]))[0] });
  } catch (error) {
    sendError(res, error, "Importation impossible");
  }
});

/** Retire une grille du groupe (la grille reste dans ses ressources; les notes déjà données sont conservées). */
router.delete("/:id/rubrics/:rubricId", roles("admin", "teacher"), async (req, res) => {
  const group = await Group.findOneAndUpdate(mine(req, { _id: req.params.id }), { $pull: { rubrics: req.params.rubricId } }, { new: true });
  if (!group) return res.status(404).json({ message: "Groupe introuvable" });
  res.json((await present(req, [group]))[0]);
});

const enrollSchema = z.union([
  z.object({ studentId: z.string().min(1) }),
  z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    name: z.string().optional(),
    email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().email().optional()),
  }),
]);

/** Inscrit un élève existant (fiche permanente) ou en crée un nouveau dans ce groupe. */
router.post("/:id/students", roles("admin", "teacher"), async (req, res) => {
  try {
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    const body = enrollSchema.parse(req.body);
    let student;
    if ("studentId" in body) {
      if (!isId(body.studentId)) throw httpError(400, "Élève invalide");
      student = await Student.findOne(mine(req, { _id: body.studentId }));
      if (!student) throw httpError(404, "Élève introuvable");
    } else {
      const { group: _g, ...person } = normalizeStudentPayload(body);
      student = await Student.create({ ...person, createdBy: req.user._id });
    }
    await enrollStudent(req.user._id, student._id, group);
    res.status(201).json({ student, group: { _id: group._id, name: group.name } });
  } catch (error) {
    sendError(res, error, "Inscription impossible");
  }
});

router.delete("/:id/students/:studentId", roles("admin", "teacher"), async (req, res) => {
  const group = await Group.findOne(mine(req, { _id: req.params.id }));
  if (!group) return res.status(404).json({ message: "Groupe introuvable" });
  await unenrollStudent(req.params.studentId, group.session);
  res.status(204).send();
});

router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  const when = new Date();
  const group = await Group.findOneAndUpdate(mine(req, { _id: req.params.id, archivedAt: null }), { $set: { archivedAt: when } }, { new: true });
  if (!group) return res.status(404).json({ message: "Groupe introuvable ou déjà archivé" });
  await Enrollment.updateMany({ group: group._id, archivedAt: null }, { $set: { archivedAt: when } });
  res.json((await present(req, [group]))[0]);
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  const group = await Group.findOne(mine(req, { _id: req.params.id }));
  if (!group) return res.status(404).json({ message: "Groupe introuvable" });
  const session = await Session.findOne({ _id: group.session, createdBy: req.user._id });
  if (session?.archivedAt) {
    return res.status(409).json({ message: "La session de ce groupe est archivée: restaure d'abord la session." });
  }
  const when = group.archivedAt;
  group.archivedAt = null;
  await group.save();
  if (when) await Enrollment.updateMany({ group: group._id, archivedAt: when }, { $set: { archivedAt: null } });
  res.json((await present(req, [group]))[0]);
});

/** Supprime le groupe et ses inscriptions; refusé s'il contient des évaluations, sauf `?force=1` (elles perdent leur groupe). */
router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const group = await Group.findOne(mine(req, { _id: req.params.id }));
    if (!group) return res.status(404).json({ message: "Groupe introuvable" });
    const evaluations = await Evaluation.countDocuments({ owner: req.user._id, group: group._id });
    const force = req.query.force === "1" || req.query.force === "true";
    if (evaluations > 0 && !force) {
      return res.status(409).json({ message: "Ce groupe contient des évaluations: archive-le, ou confirme la suppression.", evaluations });
    }
    await Enrollment.deleteMany({ group: group._id });
    await Evaluation.updateMany({ owner: req.user._id, group: group._id }, { $set: { group: null } });
    await group.deleteOne();
    res.status(204).send();
  } catch (error) {
    sendError(res, error, "Suppression impossible");
  }
});

module.exports = router;
