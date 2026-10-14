const Session = require("../models/Session");
const Course = require("../models/Course");
const Rubric = require("../models/Rubric");
const Student = require("../models/Student");
const { shouldAutoArchive, todayStr } = require("../utils/sessionDates");

/** Archive les grilles « archivées avec le cours » des cours donnés (celles encore actives seulement). */
async function archiveCourseRubrics(courseIds, when) {
  if (!courseIds.length) return 0;
  const r = await Rubric.updateMany(
    { course: { $in: courseIds }, archiveWithCourse: true, archivedAt: null },
    { $set: { archivedAt: when } }
  );
  return r.modifiedCount;
}

/** Restaure les grilles que l'archivage de ces cours (à cette date précise) avait rangées. */
async function restoreCourseRubrics(courseIds, when) {
  if (!courseIds.length || !when) return 0;
  const r = await Rubric.updateMany({ course: { $in: courseIds }, archivedAt: when }, { $set: { archivedAt: null } });
  return r.modifiedCount;
}

/**
 * Archive une session et tout ce qui lui est rattaché (cours, grilles, groupes d'étudiants).
 * Seuls les éléments encore actifs reçoivent la date d'archivage de la session : à la restauration,
 * on ne remet donc en service que ce que cette archive a elle-même rangé.
 */
async function archiveSession(session, by = "manual") {
  const when = new Date();
  session.archivedAt = when;
  session.archivedBy = by;
  await session.save();
  const filter = { session: session._id, archivedAt: null };
  const [courses, students] = await Promise.all([
    Course.updateMany(filter, { $set: { archivedAt: when } }),
    Student.updateMany(filter, { $set: { archivedAt: when } }),
  ]);
  const ids = await Course.find({ session: session._id, archivedAt: when }).distinct("_id");
  const rubrics = await archiveCourseRubrics(ids, when);
  return { courses: courses.modifiedCount, rubrics, students: students.modifiedCount };
}

async function restoreSession(session) {
  const when = session.archivedAt;
  session.archivedAt = null;
  session.archivedBy = "";
  await session.save();
  if (!when) return { courses: 0, rubrics: 0, students: 0 };
  const filter = { session: session._id, archivedAt: when };
  const ids = await Course.find(filter).distinct("_id");
  const rubrics = await restoreCourseRubrics(ids, when);
  const [courses, students] = await Promise.all([
    Course.updateMany(filter, { $set: { archivedAt: null } }),
    Student.updateMany(filter, { $set: { archivedAt: null } }),
  ]);
  return { courses: courses.modifiedCount, rubrics, students: students.modifiedCount };
}

/** Archive les sessions échues (fin + délai de grâce dépassés). Sans ownerId : toutes les sessions. */
async function autoArchiveExpiredSessions(ownerId, today = todayStr()) {
  const query = { archivedAt: null, autoArchive: { $ne: false } };
  if (ownerId) query.createdBy = ownerId;
  const candidates = await Session.find(query);
  const archived = [];
  for (const session of candidates) {
    if (!shouldAutoArchive(session, today)) continue;
    await archiveSession(session, "auto");
    archived.push(session._id);
  }
  return archived;
}

module.exports = { archiveCourseRubrics, restoreCourseRubrics, archiveSession, restoreSession, autoArchiveExpiredSessions };
