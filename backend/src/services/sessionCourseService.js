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

/**
 * Évaluations corrigeables pour un groupe: les évaluations cochées (au niveau de la session) des cours que le
 * groupe suit. Rien n'est recopié dans le groupe: la session est la seule source.
 */
function rubricIdsOf(session, group) {
  const followed = new Set((group.courses || []).map(str));
  return (session?.courses || []).filter((c) => followed.has(str(c.course))).flatMap((c) => c.rubrics.map(str));
}

/** Même chose pour plusieurs groupes: Map(id du groupe -> ids de grilles). */
async function rubricIdsByGroup(ownerId, groups) {
  const sessions = await Session.find({ createdBy: ownerId, _id: { $in: [...new Set(groups.map((g) => str(g.session)))] } }).select("courses");
  const byId = new Map(sessions.map((s) => [str(s._id), s]));
  return new Map(groups.map((g) => [str(g._id), rubricIdsOf(byId.get(str(g.session)), g)]));
}

/** Ajoute le cours à la session (sans effet s'il y est déjà). `rubricIds` omis: les évaluations actives. */
async function addCourse(ownerId, session, courseId, rubricIds) {
  if (!isId(courseId)) throw httpError(400, "Cours invalide");
  const course = await Course.findOne({ _id: courseId, createdBy: ownerId });
  if (!course) throw httpError(404, "Cours introuvable");
  if (session.courses.some((c) => str(c.course) === str(course._id))) return course;
  const rubrics = rubricIds ? await rubricsOfCourse(ownerId, course._id, rubricIds) : await defaultRubricIds(ownerId, course._id);
  session.courses.push({ course: course._id, rubrics });
  await session.save();
  return course;
}

async function setCourseRubrics(ownerId, session, courseId, rubricIds) {
  const entry = session.courses.find((c) => str(c.course) === str(courseId));
  if (!entry) throw httpError(404, "Ce cours n'est pas dans la session");
  entry.rubrics = await rubricsOfCourse(ownerId, courseId, rubricIds);
  await session.save();
}

/** Retire le cours de la session; les groupes ne le suivent plus et perdent ses évaluations. */
async function removeCourse(ownerId, session, courseId) {
  const before = session.courses.length;
  session.courses = session.courses.filter((c) => str(c.course) !== str(courseId));
  if (session.courses.length === before) throw httpError(404, "Ce cours n'est pas dans la session");
  await session.save();
  await Group.updateMany({ createdBy: ownerId, session: session._id }, { $pull: { courses: courseId } });
}

/**
 * Les imports faits groupe par groupe (anciennes routes) sont reportés dans la session, sinon la prochaine
 * synchro les effacerait: le cours y est ajouté au besoin, avec seulement ces évaluations.
 */
async function addRubrics(ownerId, sessionId, rubricIds) {
  const session = await Session.findOne({ _id: sessionId, createdBy: ownerId });
  if (!session || !rubricIds?.length) return;
  const rubrics = await Rubric.find({ createdBy: ownerId, _id: { $in: rubricIds.filter(isId) } }).select("course").lean();
  for (const r of rubrics) {
    const entry = session.courses.find((c) => str(c.course) === str(r.course));
    if (!entry) session.courses.push({ course: r.course, rubrics: [r._id] });
    else if (!entry.rubrics.some((id) => str(id) === str(r._id))) entry.rubrics.push(r._id);
  }
  await session.save();
}

/** Ajoute à la session les cours qui n'y sont pas encore (création d'un groupe qui reprend des cours). */
async function ensureCoursesInSession(ownerId, session, courseIds) {
  for (const id of courseIds) await addCourse(ownerId, session, id);
}

/** Vue pour la page: chaque cours de la session, ses évaluations (importées ou non) et ses groupes. */
async function describe(ownerId, session) {
  const ids = session.courses.map((c) => c.course);
  const [courses, rubrics, groups, counts] = await Promise.all([
    Course.find({ createdBy: ownerId, _id: { $in: ids } }).select("title code color icon archivedAt").lean(),
    Rubric.find({ createdBy: ownerId, course: { $in: ids }, archivedAt: null })
      .select("title taskTitle course isActive version")
      .sort({ title: 1 })
      .lean(),
    Group.find({ createdBy: ownerId, session: session._id, archivedAt: null }).select("name color icon courses").sort({ name: 1 }).lean(),
    Evaluation.aggregate([{ $match: { owner: ownerId, session: session._id } }, { $group: { _id: "$rubric", n: { $sum: 1 } } }]),
  ]);
  const corrected = new Map(counts.map((c) => [str(c._id), c.n]));
  const cById = new Map(courses.map((c) => [str(c._id), c]));
  return session.courses
    .map((entry) => {
      const course = cById.get(str(entry.course));
      if (!course) return null;
      const imported = new Set(entry.rubrics.map(str));
      return {
        course,
        rubrics: rubrics.filter((r) => str(r.course) === str(entry.course)).map((r) => ({ ...r, imported: imported.has(str(r._id)), correctedCount: corrected.get(str(r._id)) || 0 })),
        groups: groups.filter((g) => g.courses.some((c) => str(c) === str(entry.course))).map(({ courses: _c, ...g }) => g),
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
    }));
    await s.save();
    done += 1;
  }
  return done;
}

module.exports = { addRubrics, addCourse, setCourseRubrics, removeCourse, ensureCoursesInSession, rubricIdsOf, rubricIdsByGroup, describe, backfillSessionCourses };
