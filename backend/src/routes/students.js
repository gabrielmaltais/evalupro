const express = require("express");
const { z } = require("zod");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");
const EvaluationEmailDelivery = require("../models/EvaluationEmailDelivery");
const { auth } = require("../middleware/auth");
const { normalizeStudentPayload } = require("../utils/studentName");
const { resolveActiveSession } = require("../services/sessionService");
const { forgetGroup } = require("../services/commonGroupService");
const { courseIdsOf } = require("../services/sessionCourseService");
const { findOrCreateGroup, enrollStudent, unenrollStudent, attachGroups, isId, httpError } = require("../services/groupService");

const router = express.Router();

const studentFields = z.object({
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().email().optional()),
  /** Nom du groupe dans la session active (créé au besoin). Vide: l'élève n'est dans aucun groupe. */
  group: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
});

router.use(auth);

const noSessionMessage = "Crée d'abord une session pour y placer des groupes.";

async function activeSessionOrFail(req) {
  const session = await resolveActiveSession(req.user);
  if (!session) throw httpError(409, noSessionMessage);
  return session;
}

function sendError(res, error, fallback) {
  const code = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
  const explicit = code !== 400;
  res.status(code).json(explicit ? { message: error.message } : { message: fallback, details: error.message });
}

/** Élèves de la session active (inscrits) plus ceux qui n'ont encore aucun groupe nulle part. */
async function sessionScopeStudents(req, session) {
  const owner = req.user._id;
  const filter = { createdBy: owner, archivedAt: null };
  if (!session) return Student.find(filter).sort({ lastName: 1, firstName: 1, name: 1 });
  const [inSession, everEnrolled] = await Promise.all([
    Enrollment.find({ session: session._id, createdBy: owner, archivedAt: null }).distinct("student"),
    Enrollment.find({ createdBy: owner }).distinct("student"),
  ]);
  const enrolledAnywhere = new Set(everEnrolled.map(String));
  const inSessionSet = new Set(inSession.map(String));
  const all = await Student.find(filter).sort({ lastName: 1, firstName: 1, name: 1 });
  return all.filter((s) => inSessionSet.has(String(s._id)) || !enrolledAnywhere.has(String(s._id)));
}

router.get("/", async (req, res) => {
  try {
    const session = await resolveActiveSession(req.user);
    const archived = req.query.archived === "1" || req.query.archived === "true";
    let items;
    if (archived) {
      items = await Student.find({ createdBy: req.user._id, archivedAt: { $ne: null } }).sort({ lastName: 1, firstName: 1, name: 1 });
    } else if (req.query.scope === "library") {
      items = await Student.find({ createdBy: req.user._id, archivedAt: null }).sort({ lastName: 1, firstName: 1, name: 1 });
    } else {
      items = await sessionScopeStudents(req, session);
    }
    res.json(await attachGroups(items, session?._id, { includeArchived: archived }));
  } catch (error) {
    sendError(res, error, "Chargement des étudiants impossible");
  }
});

router.get("/group-dashboard", async (req, res) => {
  try {
    const owner = req.user._id;
    const session = await resolveActiveSession(req.user);
    const students = await sessionScopeStudents(req, session);
    const withGroup = await attachGroups(students, session?._id);
    const groups = session ? await Group.find({ createdBy: owner, session: session._id, archivedAt: null }) : [];

    const byGroup = new Map();
    const row = (name, extra = {}) => {
      if (!byGroup.has(name)) {
        byGroup.set(name, { group: name, groupId: null, students: 0, evaluations: 0, avgPct: 0, sent: 0, failed: 0, courses: [], ...extra });
      }
      return byGroup.get(name);
    };
    groups.forEach((g) => row(g.name, { groupId: g._id, courses: courseIdsOf(session, g) }));
    withGroup.forEach((s) => {
      row(s.group || "Sans groupe").students += 1;
    });

    const groupByStudent = new Map(withGroup.map((s) => [String(s._id), s.group || "Sans groupe"]));
    const evaluations = await Evaluation.find({ owner, studentId: { $in: withGroup.map((s) => s._id) } })
      .select("studentId totalScore totalMax session")
      .lean();
    const deliveries = await EvaluationEmailDelivery.find({ owner, studentId: { $in: withGroup.map((s) => s._id) } })
      .select("studentId status group")
      .lean();

    const scoreAcc = {};
    evaluations.forEach((e) => {
      if (session && e.session && String(e.session) !== String(session._id)) return;
      const g = groupByStudent.get(String(e.studentId)) || "Sans groupe";
      row(g).evaluations += 1;
      const pct = e.totalMax > 0 ? (Number(e.totalScore || 0) / Number(e.totalMax || 1)) * 100 : 0;
      scoreAcc[g] = scoreAcc[g] || { sum: 0, n: 0 };
      scoreAcc[g].sum += pct;
      scoreAcc[g].n += 1;
    });
    deliveries.forEach((d) => {
      const g = d.group || groupByStudent.get(String(d.studentId)) || "Sans groupe";
      if (d.status === "sent") row(g).sent += 1;
      if (d.status === "failed") row(g).failed += 1;
    });
    byGroup.forEach((r, g) => {
      const acc = scoreAcc[g];
      r.avgPct = acc?.n ? Number((acc.sum / acc.n).toFixed(1)) : 0;
    });

    res.json(Array.from(byGroup.values()).sort((a, b) => a.group.localeCompare(b.group)));
  } catch (error) {
    sendError(res, error, "Chargement des groupes impossible");
  }
});

/** Crée la fiche et, si un groupe est indiqué, inscrit l'élève dans ce groupe de la session active. */
async function createStudent(req, raw, session, groupCache) {
  const { group, ...person } = normalizeStudentPayload(raw);
  const item = await Student.create({ ...person, createdBy: req.user._id });
  if (group) {
    if (!session) throw httpError(409, noSessionMessage);
    if (!groupCache.has(group)) groupCache.set(group, await findOrCreateGroup(req.user._id, session._id, group));
    await enrollStudent(req.user._id, item._id, groupCache.get(group));
  }
  return item;
}

router.post("/", async (req, res) => {
  try {
    const raw = studentFields.parse(req.body);
    const session = raw.group ? await activeSessionOrFail(req) : await resolveActiveSession(req.user);
    const item = await createStudent(req, raw, session, new Map());
    res.status(201).json((await attachGroups([item], session?._id))[0]);
  } catch (error) {
    sendError(res, error, "Etudiant invalide");
  }
});

const bulkStudentSchema = z.object({
  students: z.array(studentFields),
});

router.post("/bulk", async (req, res) => {
  try {
    const payload = bulkStudentSchema.parse(req.body);
    const session = await resolveActiveSession(req.user);
    if (!session && payload.students.some((s) => s.group)) throw httpError(409, noSessionMessage);
    const cache = new Map();
    const created = [];
    for (const s of payload.students) created.push(await createStudent(req, s, session, cache));
    res.status(201).json(await attachGroups(created, session?._id));
  } catch (error) {
    sendError(res, error, "Donnees invalides");
  }
});

router.put("/:id", async (req, res) => {
  try {
    const raw = studentFields.partial().parse(req.body);
    const existing = await Student.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
    if (!existing) return res.status(404).json({ message: "Etudiant introuvable" });
    const merged = {
      firstName: raw.firstName !== undefined ? raw.firstName : existing.firstName ?? "",
      lastName: raw.lastName !== undefined ? raw.lastName : existing.lastName ?? "",
      name: raw.name !== undefined ? raw.name : existing.name,
      email: raw.email !== undefined ? raw.email : existing.email,
    };
    const { group: _ignored, ...person } = normalizeStudentPayload(merged);
    const item = await Student.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: person },
      { new: true, runValidators: true }
    );
    const session = await resolveActiveSession(req.user);
    // `group` présent dans la requête: vide = retire du groupe, sinon inscrit dans ce groupe (session active).
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "group")) {
      const name = String(req.body.group || "").trim();
      if (!name) {
        if (session) await unenrollStudent(item._id, session._id);
      } else {
        if (!session) throw httpError(409, noSessionMessage);
        await enrollStudent(req.user._id, item._id, await findOrCreateGroup(req.user._id, session._id, name));
      }
    }
    res.json((await attachGroups([item], session?._id))[0]);
  } catch (error) {
    sendError(res, error, "Etudiant invalide");
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await Student.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
  if (!deleted) return res.status(404).json({ message: "Etudiant introuvable" });
  await Enrollment.deleteMany({ student: deleted._id });
  res.status(204).send();
});

// --- Opérations sur les groupes par nom (session active), conservées pour l'écran des groupes ---

const groupName = z.string().trim().min(1);

/** Groupe de la session active portant ce nom, ou 404. */
async function activeGroupByName(req, name) {
  const session = await activeSessionOrFail(req);
  const group = await Group.findOne({ createdBy: req.user._id, session: session._id, name });
  if (!group) throw httpError(404, "Groupe introuvable");
  return { session, group };
}

router.get("/groups/archived", async (req, res) => {
  const groups = await Group.find({ createdBy: req.user._id, archivedAt: { $ne: null } }).sort({ name: 1 }).lean();
  const counts = await Enrollment.aggregate([
    { $match: { createdBy: req.user._id, group: { $in: groups.map((g) => g._id) } } },
    { $group: { _id: "$group", n: { $sum: 1 } } },
  ]);
  const byGroup = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(
    groups.map((g) => ({
      group: g.name,
      groupId: g._id,
      students: byGroup.get(String(g._id)) || 0,
      session: g.session || null,
      archivedAt: g.archivedAt,
    }))
  );
});

router.post("/groups/archive", async (req, res) => {
  try {
    const { group: name } = z.object({ group: groupName }).parse(req.body);
    const { group } = await activeGroupByName(req, name);
    const when = new Date();
    group.archivedAt = when;
    await group.save();
    const result = await Enrollment.updateMany({ group: group._id, archivedAt: null }, { $set: { archivedAt: when } });
    res.json({ modified: result.modifiedCount });
  } catch (error) {
    sendError(res, error, "Archivage du groupe impossible");
  }
});

router.post("/groups/restore", async (req, res) => {
  try {
    const { group: name, groupId } = z.object({ group: groupName.optional(), groupId: z.string().optional() }).parse(req.body);
    const filter = { createdBy: req.user._id, archivedAt: { $ne: null } };
    if (groupId) {
      if (!isId(groupId)) return res.status(400).json({ message: "Groupe invalide" });
      filter._id = groupId;
    } else if (name) filter.name = name;
    else return res.status(400).json({ message: "Groupe requis" });
    const group = (await Group.find(filter).sort({ archivedAt: -1 }).limit(1))[0];
    if (!group) return res.status(404).json({ message: "Groupe archivé introuvable" });
    const session = await Session.findOne({ _id: group.session, createdBy: req.user._id });
    if (session?.archivedAt) {
      return res.status(409).json({ message: "La session de ce groupe est archivée: restaure d'abord la session." });
    }
    const when = group.archivedAt;
    group.archivedAt = null;
    await group.save();
    const result = await Enrollment.updateMany({ group: group._id, archivedAt: when }, { $set: { archivedAt: null } });
    res.json({ modified: result.modifiedCount });
  } catch (error) {
    sendError(res, error, "Restauration du groupe impossible");
  }
});

/** Déplace un groupe (avec ses élèves et ses évaluations) vers une autre session. */
router.post("/groups/session", async (req, res) => {
  try {
    const { group: name, sessionId } = z.object({ group: groupName, sessionId: z.string().nullable() }).parse(req.body);
    if (!sessionId || !isId(sessionId)) return res.status(400).json({ message: "Une session valide est requise" });
    const target = await Session.findOne({ _id: sessionId, createdBy: req.user._id });
    if (!target) return res.status(404).json({ message: "Session introuvable" });
    const { group } = await activeGroupByName(req, name);
    if (String(group.session) === String(target._id)) return res.json({ modified: 0 });
    if (await Group.exists({ createdBy: req.user._id, session: target._id, name: group.name })) {
      throw httpError(409, `Un groupe « ${group.name} » existe déjà dans cette session.`);
    }
    const members = await Enrollment.find({ group: group._id }).distinct("student");
    if (await Enrollment.exists({ session: target._id, student: { $in: members } })) {
      throw httpError(409, "Certains élèves de ce groupe sont déjà inscrits dans un groupe de cette session.");
    }
    group.session = target._id;
    await group.save();
    const result = await Enrollment.updateMany({ group: group._id }, { $set: { session: target._id } });
    await Evaluation.updateMany({ owner: req.user._id, group: group._id }, { $set: { session: target._id } });
    res.json({ modified: result.modifiedCount });
  } catch (error) {
    sendError(res, error, "Rattachement impossible");
  }
});

router.post("/groups/rename", async (req, res) => {
  const schema = z.object({ from: z.string().min(1), to: z.string().min(1) });
  try {
    const { from, to } = schema.parse(req.body);
    const target = to.trim();
    const { session, group } = await activeGroupByName(req, from);
    if (target !== group.name && (await Group.exists({ createdBy: req.user._id, session: session._id, name: target }))) {
      throw httpError(409, `Un groupe « ${target} » existe déjà: utilise la fusion.`);
    }
    group.name = target;
    await group.save();
    await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: from }, { $set: { group: target } });
    const count = await Enrollment.countDocuments({ group: group._id });
    res.json({ modified: count });
  } catch (error) {
    sendError(res, error, "Renommage de groupe invalide");
  }
});

router.post("/groups/merge", async (req, res) => {
  const schema = z.object({ fromGroups: z.array(z.string().min(1)).min(1), to: z.string().min(1) });
  try {
    const { fromGroups, to } = schema.parse(req.body);
    const session = await activeSessionOrFail(req);
    const dest = await findOrCreateGroup(req.user._id, session._id, to);
    const sources = await Group.find({ createdBy: req.user._id, session: session._id, name: { $in: fromGroups }, _id: { $ne: dest._id } });
    let moved = 0;
    for (const src of sources) {
      const enrollments = await Enrollment.find({ group: src._id }).lean();
      for (const e of enrollments) {
        const clash = await Enrollment.exists({ group: dest._id, student: e.student });
        if (clash) await Enrollment.deleteOne({ _id: e._id });
        else {
          await Enrollment.updateOne({ _id: e._id }, { $set: { group: dest._id, archivedAt: dest.archivedAt || null } });
          moved += 1;
        }
      }
      await Evaluation.updateMany({ owner: req.user._id, group: src._id }, { $set: { group: dest._id } });
      await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: src.name }, { $set: { group: dest.name } });
      await src.deleteOne();
      await forgetGroup(req.user._id, src, dest._id);
    }
    res.json({ modified: moved });
  } catch (error) {
    sendError(res, error, "Fusion de groupes invalide");
  }
});

/**
 * Supprime définitivement un groupe de la session active, ses évaluations et envois courriel, et les élèves
 * qui n'appartiennent à aucun autre groupe. Sécurité: confirmGroupName doit être identique à groupName.
 */
router.post("/groups/delete-with-students", async (req, res) => {
  const schema = z.object({
    groupName: z.string().min(1),
    confirmGroupName: z.string().min(1),
  });
  try {
    const { groupName: rawName, confirmGroupName } = schema.parse(req.body);
    const gn = rawName.trim();
    if (gn !== confirmGroupName.trim()) {
      return res.status(400).json({
        message: "Confirmation refusée",
        details: "Le nom saisi ne correspond pas exactement au groupe à supprimer.",
      });
    }
    if (!gn || gn === "Sans groupe") {
      return res.status(400).json({ message: "Groupe non supprimable", details: "Ce groupe ne peut pas être effacé de cette façon." });
    }
    const session = await activeSessionOrFail(req);
    const group = await Group.findOne({ createdBy: req.user._id, session: session._id, name: gn });
    if (!group) return res.json({ deletedStudents: 0, deletedEvaluations: 0, deletedDeliveries: 0 });
    const ids = await Enrollment.find({ group: group._id }).distinct("student");
    const evalRes = await Evaluation.deleteMany({ owner: req.user._id, $or: [{ group: group._id }, { studentId: { $in: ids }, session: session._id }] });
    const delRes = await EvaluationEmailDelivery.deleteMany({ owner: req.user._id, studentId: { $in: ids }, group: gn });
    await Enrollment.deleteMany({ group: group._id });
    await group.deleteOne();
    await forgetGroup(req.user._id, group);
    // Les fiches encore inscrites ailleurs sont conservées.
    const stillEnrolled = new Set((await Enrollment.find({ student: { $in: ids } }).distinct("student")).map(String));
    const toDelete = ids.filter((id) => !stillEnrolled.has(String(id)));
    const studRes = await Student.deleteMany({ _id: { $in: toDelete }, createdBy: req.user._id });
    res.json({
      deletedStudents: studRes.deletedCount,
      deletedEvaluations: evalRes.deletedCount,
      deletedDeliveries: delRes.deletedCount,
    });
  } catch (error) {
    sendError(res, error, "Suppression de groupe impossible");
  }
});

/** Dissout le groupe: les élèves restent (sans groupe), les évaluations perdent leur groupe. */
router.delete("/groups/:groupName", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.groupName);
    const session = await resolveActiveSession(req.user);
    const group = session ? await Group.findOne({ createdBy: req.user._id, session: session._id, name }) : null;
    if (!group) return res.json({ modified: 0 });
    const result = await Enrollment.deleteMany({ group: group._id });
    await Evaluation.updateMany({ owner: req.user._id, group: group._id }, { $set: { group: null } });
    await EvaluationEmailDelivery.updateMany({ owner: req.user._id, group: name }, { $set: { group: "" } });
    await group.deleteOne();
    await forgetGroup(req.user._id, group);
    res.json({ modified: result.deletedCount });
  } catch (error) {
    sendError(res, error, "Dissolution du groupe impossible");
  }
});

// Après les routes de groupes: `/groups/archive` ne doit pas être pris pour `/:id/archive`.
/** Archive / restaure la fiche permanente d'un élève (indépendamment des sessions). */
router.post("/:id/archive", async (req, res) => {
  const item = await Student.findOneAndUpdate({ _id: req.params.id, createdBy: req.user._id }, { $set: { archivedAt: new Date() } }, { new: true });
  if (!item) return res.status(404).json({ message: "Etudiant introuvable" });
  res.json(item);
});

router.post("/:id/restore", async (req, res) => {
  const item = await Student.findOneAndUpdate({ _id: req.params.id, createdBy: req.user._id }, { $set: { archivedAt: null } }, { new: true });
  if (!item) return res.status(404).json({ message: "Etudiant introuvable" });
  res.json(item);
});

module.exports = router;
