const mongoose = require("mongoose");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const Rubric = require("../models/Rubric");

const isId = (v) => mongoose.isValidObjectId(v);

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Groupe de la session portant ce nom (créé s'il n'existe pas); retourne le document. */
async function findOrCreateGroup(ownerId, sessionId, rawName) {
  const name = String(rawName || "").trim();
  if (!name) throw httpError(400, "Nom de groupe requis");
  const existing = await Group.findOne({ createdBy: ownerId, session: sessionId, name });
  if (existing) return existing;
  return Group.create({ createdBy: ownerId, session: sessionId, name });
}

/**
 * Inscrit l'élève dans le groupe (un seul groupe par session): déplace son inscription s'il en avait déjà une.
 * Une inscription archivée reprend l'état du groupe cible.
 */
async function enrollStudent(ownerId, studentId, group) {
  return Enrollment.findOneAndUpdate(
    { student: studentId, session: group.session },
    { $set: { group: group._id, archivedAt: group.archivedAt || null }, $setOnInsert: { createdBy: ownerId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

async function unenrollStudent(studentId, sessionId) {
  return Enrollment.deleteOne({ student: studentId, session: sessionId });
}

/**
 * Ajoute à chaque élève son `group` (nom) et `groupId` pour la session donnée; "" s'il n'est pas inscrit.
 * Les inscriptions archivées sont comptées seulement si `includeArchived`.
 */
async function attachGroups(students, sessionId, { includeArchived = false } = {}) {
  const plain = students.map((s) => (s.toObject ? s.toObject() : s));
  if (!sessionId || !plain.length) return plain.map((s) => ({ ...s, group: "", groupId: null }));
  const filter = { session: sessionId, student: { $in: plain.map((s) => s._id) } };
  if (!includeArchived) filter.archivedAt = null;
  const enrollments = await Enrollment.find(filter).populate("group", "name").lean();
  const byStudent = new Map(enrollments.map((e) => [String(e.student), e]));
  return plain.map((s) => {
    const e = byStudent.get(String(s._id));
    return { ...s, group: e?.group?.name || "", groupId: e?.group?._id || null };
  });
}

/** Nom du groupe d'un élève dans la session ("" s'il n'en a pas). */
async function groupNameFor(studentId, sessionId) {
  if (!sessionId) return "";
  const e = await Enrollment.findOne({ student: studentId, session: sessionId }).populate("group", "name").lean();
  return e?.group?.name || "";
}

/** Élèves inscrits (non archivés) dans le groupe donné. */
async function studentsOfGroup(ownerId, groupId, projection) {
  const enrollments = await Enrollment.find({ group: groupId, createdBy: ownerId, archivedAt: null }).select("student").lean();
  return Student.find({ _id: { $in: enrollments.map((e) => e.student) }, createdBy: ownerId, archivedAt: null }).select(projection);
}

/** Grilles utilisables en correction pour ce groupe: celles qui y ont été importées. */
async function availableRubrics(ownerId, group, { includeArchived = false } = {}) {
  const filter = { createdBy: ownerId, _id: { $in: group.rubrics || [] } };
  if (!includeArchived) filter.archivedAt = null;
  return Rubric.find(filter).sort({ title: 1 });
}

/** Groupes (de la session) dans lesquels la grille a été importée. */
async function groupsOfRubric(ownerId, sessionId, rubric) {
  if (!sessionId) return [];
  return Group.find({ createdBy: ownerId, session: sessionId, rubrics: rubric._id }).sort({ name: 1 });
}

/**
 * Importe des grilles dans un groupe: leur cours est relié au groupe au passage (sans rien importer d'autre
 * de ce cours). Retourne le nombre de grilles ajoutées.
 */
async function importRubrics(ownerId, group, rubricIds) {
  const rubrics = await Rubric.find({ createdBy: ownerId, _id: { $in: rubricIds.filter(isId) } }).select("_id course");
  if (!rubrics.length) return 0;
  const have = new Set((group.rubrics || []).map(String));
  const fresh = rubrics.filter((r) => !have.has(String(r._id)));
  await Group.updateOne(
    { _id: group._id },
    { $addToSet: { rubrics: { $each: rubrics.map((r) => r._id) }, courses: { $each: rubrics.map((r) => r.course) } } }
  );
  // require tardif: sessionCourseService dépend de ce module.
  await require("./sessionCourseService").addRubrics(ownerId, group.session, rubrics.map((r) => r._id));
  return fresh.length;
}

module.exports = {
  isId,
  httpError,
  findOrCreateGroup,
  enrollStudent,
  unenrollStudent,
  attachGroups,
  groupNameFor,
  studentsOfGroup,
  availableRubrics,
  groupsOfRubric,
  importRubrics,
};
