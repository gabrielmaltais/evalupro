const mongoose = require("mongoose");
const Session = require("../models/Session");
const Group = require("../models/Group");
const Course = require("../models/Course");
const Rubric = require("../models/Rubric");
const Evaluation = require("../models/Evaluation");
const { isId, httpError } = require("./groupService");

const str = String;

/** Évaluations (grilles) actives et non archivées d'un cours: celles cochées par défaut à l'ajout. */
async function defaultRubricIds(ownerId, courseId) {
  return Rubric.find({ createdBy: ownerId, course: courseId, isActive: true, archivedAt: null }).distinct("_id");
}

/** Ids de grilles de l'utilisateur qui appartiennent bien à ce cours. */
async function rubricsOfCourse(ownerId, courseId, ids) {
  const valid = (ids || []).filter(isId);
  if (!valid.length) return [];
  return Rubric.find({ createdBy: ownerId, course: courseId, _id: { $in: valid } }).distinct("_id");
}

/** Ids de groupes (non archivés) de cette session. */
async function groupsOfSession(ownerId, session, ids) {
  const valid = [...new Set((ids || []).filter(isId).map(str))];
  if (!valid.length) return [];
  const found = await Group.find({ createdBy: ownerId, session: session._id, archivedAt: null, _id: { $in: valid } }).distinct("_id");
  if (found.length !== valid.length) throw httpError(400, "Groupe introuvable dans cette session");
  return found;
}

const entriesOf = (session, groupId) => (session?.courses || []).filter((c) => (c.groups || []).some((g) => str(g) === str(groupId)));

/**
 * Évaluations corrigeables pour un groupe: les évaluations cochées des cours donnés à ce groupe dans la session.
 * Rien n'est recopié dans le groupe: la session est la seule source.
 */
const rubricIdsOf = (session, group) => entriesOf(session, group._id).flatMap((c) => c.rubrics.map(str));

/** Cours (ids) donnés à ce groupe dans la session. */
const courseIdsOf = (session, group) => [...new Set(entriesOf(session, group._id).map((c) => str(c.course)))];

/** Même chose pour plusieurs groupes: Map(id du groupe -> ids de grilles). */
async function rubricIdsByGroup(ownerId, groups) {
  const sessions = await Session.find({ createdBy: ownerId, _id: { $in: [...new Set(groups.map((g) => str(g.session)))] } }).select("courses");
  const byId = new Map(sessions.map((s) => [str(s._id), s]));
  return new Map(groups.map((g) => [str(g._id), rubricIdsOf(byId.get(str(g.session)), g)]));
}

/** Un groupe ne suit pas deux fois le même cours dans une session (ce serait mélanger les cartes). */
function assertNoDuplicate(session, courseId, groupIds, exceptEntryId) {
  for (const entry of session.courses) {
    if (str(entry.course) !== str(courseId) || str(entry._id) === str(exceptEntryId)) continue;
    const clash = groupIds.find((g) => entry.groups.some((x) => str(x) === str(g)));
    if (clash) throw httpError(409, "Ce groupe suit déjà ce cours dans la session.");
  }
}

/** Ajoute une ligne de cours à la session (le même cours peut y figurer plusieurs fois, pour d'autres groupes). */
async function addCourse(ownerId, session, courseId, rubricIds, groupIds = []) {
  if (!isId(courseId)) throw httpError(400, "Cours invalide");
  const course = await Course.findOne({ _id: courseId, createdBy: ownerId });
  if (!course) throw httpError(404, "Cours introuvable");
  const groups = await groupsOfSession(ownerId, session, groupIds);
  assertNoDuplicate(session, course._id, groups);
  const rubrics = rubricIds ? await rubricsOfCourse(ownerId, course._id, rubricIds) : await defaultRubricIds(ownerId, course._id);
  session.courses.push({ course: course._id, rubrics, groups });
  await session.save();
  return course;
}

/** Modifie une ligne: ses évaluations cochées et/ou ses groupes. */
async function updateEntry(ownerId, session, entryId, { rubricIds, groupIds }) {
  const entry = session.courses.id(entryId);
  if (!entry) throw httpError(404, "Ce cours n'est pas dans la session");
  if (groupIds !== undefined) {
    const groups = await groupsOfSession(ownerId, session, groupIds);
    assertNoDuplicate(session, entry.course, groups, entry._id);
    entry.groups = groups;
  }
  if (rubricIds !== undefined) entry.rubrics = await rubricsOfCourse(ownerId, entry.course, rubricIds);
  await session.save();
}

/** Retire la ligne de la session; ses groupes ne peuvent plus corriger ses évaluations (les copies restent). */
async function removeEntry(session, entryId) {
  if (!session.courses.id(entryId)) throw httpError(404, "Ce cours n'est pas dans la session");
  session.courses.pull(entryId);
  await session.save();
}

/** Retire un groupe (supprimé ou fusionné) de toutes les lignes de ses sessions; `into` le remplace s'il est donné. */
async function detachGroup(groupId, into) {
  if (into) await Session.updateMany({ "courses.groups": groupId }, { $addToSet: { "courses.$[e].groups": into } }, { arrayFilters: [{ "e.groups": groupId }] });
  await Session.updateMany({ "courses.groups": groupId }, { $pull: { "courses.$[].groups": groupId } });
}

/**
 * Remplace une évaluation par sa copie dans les lignes qui la contiennent. Si la copie est d'un autre cours, elle
 * est cochée dans une nouvelle ligne de ce cours, pour les mêmes groupes.
 */
async function replaceRubric(ownerId, session, src, item) {
  for (const entry of [...session.courses]) {
    if (!entry.rubrics.some((r) => str(r) === str(src._id))) continue;
    entry.rubrics = entry.rubrics.filter((r) => str(r) !== str(src._id));
    if (str(entry.course) === str(item.course)) entry.rubrics.push(item._id);
    else session.courses.push({ course: item.course, rubrics: [item._id], groups: entry.groups });
  }
  await session.save();
}

/** Coche une évaluation dans une ligne de son cours (la première), ou crée une ligne sans groupe au besoin. */
async function addRubrics(ownerId, sessionId, rubricIds) {
  const session = await Session.findOne({ _id: sessionId, createdBy: ownerId });
  if (!session || !rubricIds?.length) return;
  const rubrics = await Rubric.find({ createdBy: ownerId, _id: { $in: rubricIds.filter(isId) } }).select("course").lean();
  for (const r of rubrics) {
    const entry = session.courses.find((c) => str(c.course) === str(r.course));
    if (!entry) session.courses.push({ course: r.course, rubrics: [r._id], groups: [] });
    else if (!entry.rubrics.some((id) => str(id) === str(r._id))) entry.rubrics.push(r._id);
  }
  await session.save();
}

/** Vue pour la page: chaque ligne de cours avec ses évaluations (cochées ou non, et copies corrigées) et ses groupes. */
async function describe(ownerId, session) {
  const ids = session.courses.map((c) => c.course);
  const groupIds = [...new Set(session.courses.flatMap((c) => c.groups.map(str)))];
  const [courses, rubrics, groups, counts] = await Promise.all([
    Course.find({ createdBy: ownerId, _id: { $in: ids } }).select("title code color icon archivedAt").lean(),
    Rubric.find({ createdBy: ownerId, course: { $in: ids }, archivedAt: null })
      .select("title taskTitle course isActive version")
      .sort({ title: 1 })
      .lean(),
    Group.find({ createdBy: ownerId, session: session._id, archivedAt: null, _id: { $in: groupIds } }).select("name color icon").sort({ name: 1 }).lean(),
    Evaluation.aggregate([{ $match: { owner: ownerId, session: session._id } }, { $group: { _id: { r: "$rubric", g: "$group" }, n: { $sum: 1 } } }]),
  ]);
  const cById = new Map(courses.map((c) => [str(c._id), c]));
  const gById = new Map(groups.map((g) => [str(g._id), g]));
  return session.courses
    .map((entry) => {
      const course = cById.get(str(entry.course));
      if (!course) return null;
      const imported = new Set(entry.rubrics.map(str));
      const entryGroups = entry.groups.map((g) => gById.get(str(g))).filter(Boolean);
      const mine = new Set(entryGroups.map((g) => str(g._id)));
      // Copies de cette ligne: celles de ses groupes (toute la session si la ligne n'a pas de groupe).
      const corrected = (rid) =>
        counts.filter((c) => str(c._id.r) === rid && (mine.size ? mine.has(str(c._id.g)) : true)).reduce((sum, c) => sum + c.n, 0);
      return {
        _id: entry._id,
        course,
        rubrics: rubrics
          .filter((r) => str(r.course) === str(entry.course))
          .map((r) => ({ ...r, imported: imported.has(str(r._id)), correctedCount: corrected(str(r._id)) })),
        groups: entryGroups,
      };
    })
    .filter(Boolean);
}

/**
 * Au démarrage: les sessions créées avant cette fonction n'ont pas de liste de cours; on la déduit de leurs
 * groupes (cours liés, évaluations déjà importées). Idempotent: une session qui a des cours est ignorée.
 */
async function backfillSessionCourses() {
  const sessions = await Session.find({ "courses.0": { $exists: false } });
  let done = 0;
  for (const s of sessions) {
    const groups = await Group.find({ session: s._id });
    if (!groups.length) continue;
    const courseIds = [...new Set(groups.flatMap((g) => g.courses.map(str)))];
    if (!courseIds.length) continue;
    const rubricIds = [...new Set(groups.flatMap((g) => g.rubrics.map(str)))];
    const rubrics = await Rubric.find({ _id: { $in: rubricIds } }).select("course").lean();
    s.courses = courseIds.map((cid) => ({
      course: cid,
      rubrics: rubrics.filter((r) => str(r.course) === cid).map((r) => r._id),
      groups: groups.filter((g) => g.courses.some((c) => str(c) === cid)).map((g) => g._id),
    }));
    await s.save();
    done += 1;
  }
  return done;
}

/**
 * Ancien modèle: une ligne par cours, suivie par les groupes dont `Group.courses` le contenait. On écrit ces
 * groupes et un identifiant dans la ligne (lecture brute: Mongoose inventerait un autre _id à chaque lecture).
 * Idempotent: une ligne qui a déjà `_id` et `groups` n'est pas touchée.
 */
async function migrateEntryGroups() {
  const col = mongoose.connection.collection("sessions");
  let done = 0;
  for await (const s of col.find({ courses: { $elemMatch: { $or: [{ _id: { $exists: false } }, { groups: { $exists: false } }] } } })) {
    const groups = await Group.find({ session: s._id }).select("courses").lean();
    const courses = s.courses.map((e) => ({
      ...e,
      _id: e._id || new mongoose.Types.ObjectId(),
      groups: e.groups || groups.filter((g) => (g.courses || []).some((c) => str(c) === str(e.course))).map((g) => g._id),
    }));
    await col.updateOne({ _id: s._id }, { $set: { courses } });
    done += 1;
  }
  return done;
}

module.exports = { addRubrics, addCourse, updateEntry, removeEntry, detachGroup, replaceRubric, rubricIdsOf, courseIdsOf, rubricIdsByGroup, describe, backfillSessionCourses, migrateEntryGroups };
