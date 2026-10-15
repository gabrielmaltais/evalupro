const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Session = require("../models/Session");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const Evaluation = require("../models/Evaluation");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");
const {
  archiveSession,
  restoreSession,
  autoArchiveExpiredSessions,
  resolveActiveSession,
  countSessionEvaluations,
} = require("../services/sessionService");
const { validateSessionDates, sessionStatus, archiveAfterDate } = require("../utils/sessionDates");
const { toCsv } = require("../utils/csv");
const sessionCourses = require("../services/sessionCourseService");

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
  /** Groupes à reprendre (par défaut: tous les groupes actifs de la session source). */
  groupIds: z.array(z.string()).optional(),
  /** Reprendre aussi les grilles importées (par défaut non: on réimporte les versions à jour). */
  carryRubrics: z.boolean().optional(),
  /** Inscrire dans les nouveaux groupes les mêmes élèves (leurs fiches permanentes sont réutilisées). */
  carryStudents: z.boolean().optional(),
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
    counts: { groups: 0, students: 0, evaluations: 0, ...counts },
  };
}

async function countsFor(ownerId, sessionIds) {
  if (!sessionIds.length) return new Map();
  const [groups, students, evaluations] = await Promise.all([
    Group.aggregate([{ $match: { createdBy: ownerId, session: { $in: sessionIds } } }, { $group: { _id: "$session", n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { createdBy: ownerId, session: { $in: sessionIds } } }, { $group: { _id: "$session", n: { $sum: 1 } } }]),
    Evaluation.aggregate([{ $match: { owner: ownerId, session: { $in: sessionIds } } }, { $group: { _id: "$session", n: { $sum: 1 } } }]),
  ]);
  const out = new Map(sessionIds.map((id) => [String(id), {}]));
  groups.forEach((r) => (out.get(String(r._id)).groups = r.n));
  students.forEach((r) => (out.get(String(r._id)).students = r.n));
  evaluations.forEach((r) => (out.get(String(r._id)).evaluations = r.n));
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

/** Session sur laquelle l'utilisateur travaille (null s'il n'en a aucune d'ouverte). */
router.get("/active", async (req, res) => {
  try {
    await autoArchiveExpiredSessions(req.user._id);
    const fresh = await User.findById(req.user._id).select("activeSession");
    const session = await resolveActiveSession(fresh);
    if (!session) return res.json({ session: null });
    const counts = await countsFor(req.user._id, [session._id]);
    res.json({ session: present(session, counts.get(String(session._id))) });
  } catch (error) {
    res.status(500).json({ message: "Chargement de la session active impossible", details: error.message });
  }
});

router.put("/active", roles("admin", "teacher"), async (req, res) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string().nullable() }).parse(req.body);
    let session = null;
    if (sessionId) {
      if (!isId(sessionId)) return res.status(400).json({ message: "Session invalide" });
      session = await Session.findOne(mine(req, { _id: sessionId, archivedAt: null }));
      if (!session) return res.status(404).json({ message: "Session introuvable ou archivée" });
    }
    await User.updateOne({ _id: req.user._id }, { $set: { activeSession: session ? session._id : null } });
    const fresh = await User.findById(req.user._id).select("activeSession");
    const active = await resolveActiveSession(fresh);
    res.json({ session: active ? present(active) : null });
  } catch (error) {
    res.status(400).json({ message: "Changement de session impossible", details: error.message });
  }
});

/** Cours de la session (avec leurs évaluations et leurs groupes), pour la page « Cours et évaluations ». */
router.get("/:id/courses", async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Session invalide" });
    const session = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!session) return res.status(404).json({ message: "Session introuvable" });
    res.json(await sessionCourses.describe(req.user._id, session));
  } catch (error) {
    res.status(500).json({ message: "Chargement des cours impossible", details: error.message });
  }
});

async function editableSession(req, res) {
  if (!isId(req.params.id)) return res.status(400).json({ message: "Session invalide" }) && null;
  const session = await Session.findOne(mine(req, { _id: req.params.id }));
  if (!session) return res.status(404).json({ message: "Session introuvable" }) && null;
  if (session.archivedAt) return res.status(409).json({ message: "Cette session est archivée." }) && null;
  return session;
}

function courseError(res, error, fallback) {
  const code = Number.isInteger(error.statusCode) ? error.statusCode : 400;
  res.status(code).json(code === 400 ? { message: fallback, details: error.message } : { message: error.message });
}

/** Ajoute un cours de la bibliothèque à la session; `rubricIds` omis: ses évaluations actives sont importées. */
router.post("/:id/courses", roles("admin", "teacher"), async (req, res) => {
  try {
    const { courseId, rubricIds } = z.object({ courseId: z.string(), rubricIds: z.array(z.string()).optional() }).parse(req.body);
    const session = await editableSession(req, res);
    if (!session) return;
    await sessionCourses.addCourse(req.user._id, session, courseId, rubricIds);
    res.status(201).json(await sessionCourses.describe(req.user._id, await Session.findById(session._id)));
  } catch (error) {
    courseError(res, error, "Ajout du cours impossible");
  }
});

/** Remplace les évaluations importées pour ce cours. */
router.put("/:id/courses/:courseId", roles("admin", "teacher"), async (req, res) => {
  try {
    const { rubricIds } = z.object({ rubricIds: z.array(z.string()) }).parse(req.body);
    const session = await editableSession(req, res);
    if (!session) return;
    await sessionCourses.setCourseRubrics(req.user._id, session, req.params.courseId, rubricIds);
    res.json(await sessionCourses.describe(req.user._id, await Session.findById(session._id)));
  } catch (error) {
    courseError(res, error, "Mise à jour impossible");
  }
});

router.delete("/:id/courses/:courseId", roles("admin", "teacher"), async (req, res) => {
  try {
    const session = await editableSession(req, res);
    if (!session) return;
    await sessionCourses.removeCourse(req.user._id, session, req.params.courseId);
    res.json(await sessionCourses.describe(req.user._id, await Session.findById(session._id)));
  } catch (error) {
    courseError(res, error, "Retrait impossible");
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

/**
 * Supprime une session et ses groupes/inscriptions. Les cours, grilles et fiches d'élèves sont conservés.
 * Si elle contient des évaluations, il faut confirmer avec `?force=1` (les évaluations sont alors conservées
 * mais détachées de la session).
 */
router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    const item = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!item) return res.status(404).json({ message: "Session introuvable" });
    const evaluations = await countSessionEvaluations(req.user._id, item._id);
    const force = req.query.force === "1" || req.query.force === "true";
    if (evaluations > 0 && !force) {
      return res.status(409).json({
        message: "Cette session contient des évaluations. Archive-la plutôt, ou confirme la suppression.",
        evaluations,
      });
    }
    await item.deleteOne();
    await Promise.all([
      Enrollment.deleteMany({ session: item._id, createdBy: req.user._id }),
      Group.deleteMany({ session: item._id, createdBy: req.user._id }),
      Evaluation.updateMany({ owner: req.user._id, session: item._id }, { $set: { group: null, session: null } }),
      User.updateOne({ _id: req.user._id, activeSession: item._id }, { $set: { activeSession: null } }),
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
    if (item.archivedAt) return res.json({ session: present(item), archived: { groups: 0, students: 0 } });
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
 * Nouvelle session à partir d'une autre: reprend les groupes choisis avec les mêmes cours (ressources
 * communes) mais sans leurs grilles, à réimporter une à une pour éviter les versions obsolètes (sauf
 * `carryRubrics`). Reprend les mêmes élèves si demandé. Les évaluations ne sont jamais copiées.
 */
router.post("/:id/copy", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = copySchema.parse(req.body);
    const dateError = validateSessionDates(payload.startDate, payload.endDate);
    if (dateError) return res.status(400).json({ message: dateError });
    const source = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!source) return res.status(404).json({ message: "Session introuvable" });

    const filter = mine(req, { session: source._id, archivedAt: null });
    if (payload.groupIds) filter._id = { $in: payload.groupIds.filter(isId) };
    const sourceGroups = await Group.find(filter);

    const created = await Session.create({
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      graceDays: payload.graceDays ?? source.graceDays,
      autoArchive: payload.autoArchive ?? source.autoArchive,
      createdBy: req.user._id,
    });

    const newGroups = await Group.insertMany(
      sourceGroups.map((g) => ({
        name: g.name,
        session: created._id,
        courses: g.courses,
        color: g.color,
        icon: g.icon,
        createdBy: req.user._id,
      }))
    );

    // Les cours des groupes repris suivent; leurs évaluations seulement si demandé.
    const carriedCourses = [...new Set(sourceGroups.flatMap((g) => g.courses.map(String)))];
    if (carriedCourses.length) {
      const kept = new Map(source.courses.map((c) => [String(c.course), c.rubrics]));
      created.courses = carriedCourses.map((cid) => ({ course: cid, rubrics: payload.carryRubrics ? kept.get(cid) || [] : [] }));
      await created.save();
    }

    let carried = 0;
    if (payload.carryStudents && newGroups.length) {
      const idMap = new Map(sourceGroups.map((g, i) => [String(g._id), newGroups[i]._id]));
      const enrollments = await Enrollment.find({ group: { $in: sourceGroups.map((g) => g._id) }, createdBy: req.user._id, archivedAt: null }).lean();
      const students = await Student.find({ _id: { $in: enrollments.map((e) => e.student) }, archivedAt: null }).select("_id").lean();
      const alive = new Set(students.map((st) => String(st._id)));
      const docs = enrollments
        .filter((e) => alive.has(String(e.student)))
        .map((e) => ({ student: e.student, group: idMap.get(String(e.group)), session: created._id, createdBy: req.user._id }));
      if (docs.length) await Enrollment.insertMany(docs);
      carried = docs.length;
    }

    let archivedSource = null;
    if (payload.archiveSource && !source.archivedAt) archivedSource = await archiveSession(source, "manual");

    res.status(201).json({
      session: present(created, { groups: newGroups.length, students: carried }),
      copied: { groups: newGroups.length, students: carried },
      archivedSource,
    });
  } catch (error) {
    res.status(400).json({ message: "Copie impossible", details: error.message });
  }
});

/** Notes de la session (élèves inscrits) au format CSV, à conserver avant de tout archiver. */
router.get("/:id/export", async (req, res) => {
  try {
    const session = await Session.findOne(mine(req, { _id: req.params.id }));
    if (!session) return res.status(404).json({ message: "Session introuvable" });
    const enrollments = await Enrollment.find({ session: session._id, createdBy: req.user._id }).populate("group", "name").lean();
    const students = await Student.find({ _id: { $in: enrollments.map((e) => e.student) } }).lean();
    const groupOf = new Map(enrollments.map((e) => [String(e.student), e.group?.name || ""]));
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const evaluations = await Evaluation.find({ owner: req.user._id, session: session._id })
      .populate("rubric", "title taskTitle")
      .sort({ date: 1 })
      .lean();

    const rows = [["Groupe", "Étudiant", "Courriel", "Grille", "Évaluation", "Date", "Note", "Sur", "Pourcentage"]];
    evaluations
      .sort((a, b) => {
        const ga = groupOf.get(String(a.studentId)) || "";
        const gb = groupOf.get(String(b.studentId)) || "";
        return ga.localeCompare(gb) || String(a.studentName).localeCompare(String(b.studentName));
      })
      .forEach((ev) => {
        const st = byId.get(String(ev.studentId));
        const pct = ev.totalMax > 0 ? Math.round((Number(ev.totalScore || 0) / ev.totalMax) * 1000) / 10 : "";
        rows.push([groupOf.get(String(ev.studentId)) || "", ev.studentName, st?.email || "", ev.rubric?.title || "", ev.rubric?.taskTitle || "", ev.date, ev.totalScore, ev.totalMax, pct]);
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
