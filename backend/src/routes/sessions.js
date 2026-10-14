const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Session = require("../models/Session");
const Course = require("../models/Course");
const Rubric = require("../models/Rubric");
const Student = require("../models/Student");
const Evaluation = require("../models/Evaluation");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");
const { archiveSession, restoreSession, autoArchiveExpiredSessions } = require("../services/sessionService");
const { validateSessionDates, sessionStatus, archiveAfterDate } = require("../utils/sessionDates");
const { toCsv } = require("../utils/csv");

const router = express.Router();
router.use(auth);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)");

const sessionSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la session est requis").max(120),
  startDate: dateStr,
  endDate: dateStr,
  graceDays: z.number().int().min(0).max(365).optional(),
  autoArchive: z.boolean().optional(),
});

const copySchema = sessionSchema.extend({
  courseIds: z.array(z.string()).optional(),
  rubricIds: z.array(z.string()).optional(),
  /** Groupes (noms) auxquels les grilles copiées s'appliquent dans la nouvelle session. */
  groups: z.array(z.string().trim().min(1)).optional(),
  archiveSource: z.boolean().optional(),
});

const mine = (req, extra = {}) => ({ ...extra, createdBy: req.user._id });
const isId = (v) => mongoose.isValidObjectId(v);

function present(session, counts = {}) {
  const plain = session.toObject ? session.toObject() : session;
  return {
    ...plain,
    status: sessionStatus(plain),
    archiveAfter: archiveAfterDate(plain),
    counts: { courses: 0, rubrics: 0, groups: 0, students: 0, ...counts },
  };
}

async function countsFor(ownerId, sessionIds) {
  if (!sessionIds.length) return new Map();
  const [courses, rubrics, students] = await Promise.all([
    Course.aggregate([{ $match: { createdBy: ownerId, session: { $in: sessionIds } } }, { $group: { _id: "$session", n: { $sum: 1 } } }]),
    Rubric.aggregate([{ $match: { createdBy: ownerId, session: { $in: sessionIds } } }, { $group: { _id: "$session", n: { $sum: 1 } } }]),
    Student.aggregate([
      { $match: { createdBy: ownerId, session: { $in: sessionIds } } },
      { $group: { _id: "$session", n: { $sum: 1 }, groups: { $addToSet: "$group" } } },
    ]),
  ]);
  const out = new Map(sessionIds.map((id) => [String(id), {}]));
  courses.forEach((r) => (out.get(String(r._id)).courses = r.n));
  rubrics.forEach((r) => (out.get(String(r._id)).rubrics = r.n));
  students.forEach((r) => {
    out.get(String(r._id)).students = r.n;
    out.get(String(r._id)).groups = r.groups.filter(Boolean).length;
  });
  return out;
}

router.get("/", async (req, res) => {
  try {
    await autoArchiveExpiredSessions(req.user._id);
    const sessions = await Session.find(mine(req)).sort({ startDate: -1 });
    const counts = await countsFor(req.user._id, sessions.map((s) => s._id));
    res.json(sessions.map((s) => present(s, counts.get(String(s._id)))));
  } catch (error) {
    res.status(500).json({ message: "Chargement des sessions impossible", details: error.message });
  }
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = sessionSchema.parse(req.body);
    const dateError = validateSessionDates(payload.startDate, payload.endDate);
    if (dateError) return res.status(400).json({ message: dateError });
    const item = await Session.create({ ...payload, createdBy: req.user._id });
    res.status(201).json(present(item));
  } catch (error) {
    res.status(400).json({ message: "Session invalide", details: error.message });
  }
});

router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = sessionSchema.partial().parse(req.body);
    const item = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Session introuvable" });
    Object.assign(item, payload);
    const dateError = validateSessionDates(item.startDate, item.endDate);
    if (dateError) return res.status(400).json({ message: dateError });
    await item.save();
    res.json(present(item));
  } catch (error) {
    res.status(400).json({ message: "Session invalide", details: error.message });
  }
});

/** Supprime la session seulement : cours, grilles et groupes sont conservés, simplement détachés. */
router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const item = await Session.findOneAndDelete(mine(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Session introuvable" });
    const filter = { session: item._id };
    await Promise.all([
      Course.updateMany(filter, { $set: { session: null } }),
      Rubric.updateMany(filter, { $set: { session: null } }),
      Student.updateMany(filter, { $set: { session: null } }),
    ]);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Suppression invalide", details: error.message });
  }
});

router.post("/:id/archive", roles("admin", "teacher"), async (req, res) => {
  try {
    const item = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Session introuvable" });
    if (item.archivedAt) return res.json({ session: present(item), archived: { courses: 0, rubrics: 0, students: 0 } });
    const archived = await archiveSession(item, "manual");
    res.json({ session: present(item), archived });
  } catch (error) {
    res.status(400).json({ message: "Archivage impossible", details: error.message });
  }
});

router.post("/:id/restore", roles("admin", "teacher"), async (req, res) => {
  try {
    const item = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Session introuvable" });
    const restored = await restoreSession(item);
    // Évite que l'archivage automatique la reprenne aussitôt si ses dates sont déjà passées.
    if (item.autoArchive !== false && sessionStatus(item) === "due") {
      item.autoArchive = false;
      await item.save();
    }
    res.json({ session: present(item), restored });
  } catch (error) {
    res.status(400).json({ message: "Restauration impossible", details: error.message });
  }
});

/**
 * Nouvelle session à partir d'une autre : copie des cours et des grilles choisis (sans les évaluations
 * ni les étudiants). Les grilles copiées s'appliquent aux nouveaux groupes indiqués.
 */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = copySchema.parse(req.body);
    const dateError = validateSessionDates(payload.startDate, payload.endDate);
    if (dateError) return res.status(400).json({ message: dateError });
    const source = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!source) return res.status(404).json({ message: "Session introuvable" });

    const courseIds = (payload.courseIds || []).filter(isId);
    const rubricIds = (payload.rubricIds || []).filter(isId);
    const [courses, rubrics] = await Promise.all([
      courseIds.length ? Course.find(mine(req, { _id: { $in: courseIds }, session: source._id })) : [],
      rubricIds.length ? Rubric.find(mine(req, { _id: { $in: rubricIds }, session: source._id })) : [],
    ]);

    const created = await Session.create({
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      graceDays: payload.graceDays ?? source.graceDays,
      autoArchive: payload.autoArchive ?? source.autoArchive,
      createdBy: req.user._id,
    });

    const groups = Array.from(new Set(payload.groups || []));
    await Course.insertMany(
      courses.map((c) => ({ title: c.title, code: c.code, competencies: c.competencies, session: created._id, createdBy: req.user._id }))
    );
    await Rubric.insertMany(
      rubrics.map((r) => ({
        title: r.title,
        taskTitle: r.taskTitle,
        version: 1,
        isActive: true,
        linkCompetencies: r.linkCompetencies,
        criteria: r.criteria,
        feedbackMessages: r.feedbackMessages,
        groups,
        group: groups[0] || "",
        session: created._id,
        createdBy: req.user._id,
      }))
    );

    let archivedSource = null;
    if (payload.archiveSource && !source.archivedAt) archivedSource = await archiveSession(source, "manual");

    res.status(201).json({
      session: present(created, { courses: courses.length, rubrics: rubrics.length }),
      copied: { courses: courses.length, rubrics: rubrics.length },
      archivedSource,
    });
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

/** Notes de la session (étudiants rattachés à la session) au format CSV, à conserver avant de tout archiver. */
router.get("/:id/export", async (req, res) => {
  try {
    const session = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!session) return res.status(404).json({ message: "Session introuvable" });
    const students = await Student.find(mine(req, { session: session._id })).sort({ group: 1, lastName: 1, firstName: 1 }).lean();
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const evaluations = await Evaluation.find({ owner: req.user._id, studentId: { $in: students.map((s) => s._id) } })
      .populate("rubric", "title taskTitle")
      .sort({ date: 1 })
      .lean();

    const rows = [["Groupe", "Étudiant", "Courriel", "Grille", "Évaluation", "Date", "Note", "Sur", "Pourcentage"]];
    evaluations
      .sort((a, b) => {
        const sa = byId.get(String(a.studentId));
        const sb = byId.get(String(b.studentId));
        return String(sa?.group || "").localeCompare(String(sb?.group || "")) || String(a.studentName).localeCompare(String(b.studentName));
      })
      .forEach((ev) => {
        const st = byId.get(String(ev.studentId));
        const pct = ev.totalMax > 0 ? Math.round((Number(ev.totalScore || 0) / ev.totalMax) * 1000) / 10 : "";
        rows.push([st?.group || "", ev.studentName, st?.email || "", ev.rubric?.title || "", ev.rubric?.taskTitle || "", ev.date, ev.totalScore, ev.totalMax, pct]);
      });

    const filename = `Notes_${session.name}`.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim().replace(/\s+/g, "_") || "Notes_session";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(toCsv(rows));
  } catch (error) {
    res.status(400).json({ message: "Export impossible", details: error.message });
  }
});

module.exports = router;
