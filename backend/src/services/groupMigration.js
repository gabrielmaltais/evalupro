const mongoose = require("mongoose");
const Student = require("../models/Student");
const Rubric = require("../models/Rubric");
const Session = require("../models/Session");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const GroupStyle = require("../models/GroupStyle");
const Evaluation = require("../models/Evaluation");
const Course = require("../models/Course");
const User = require("../models/User");

const IMPORT_SESSION_NAME = "Import (groupes sans session)";
const UNSORTED_COURSE_TITLE = "Grilles non classées";
const NO_SESSION = "none";
/** Cours fictif du plan pour les anciennes grilles sans cours; remplacé par le vrai cours à l'application. */
const UNSORTED = "unsorted";

const str = (v) => (v == null ? "" : String(v));

/**
 * Calcule, sans toucher à la base, les groupes et inscriptions à créer d'après les anciennes données
 * (nom de groupe en texte sur l'élève, « groupes visés » des grilles, GroupStyle). Un groupe reçoit le cours
 * de chaque grille qui le visait.
 * Les élèves sans session sont rangés sous la clé `NO_SESSION` (session d'import créée à l'application).
 */
function planGroupMigration({ students = [], rubrics = [], styles = [] }) {
  const styleByName = new Map(styles.map((s) => [str(s.groupKey), s]));
  const groups = new Map();
  const enrollments = [];

  for (const s of students) {
    const name = str(s.group).trim();
    if (!name) continue;
    const sessionKey = s.session ? str(s.session) : NO_SESSION;
    const key = `${sessionKey}|${name}`;
    if (!groups.has(key)) {
      const style = styleByName.get(name);
      groups.set(key, {
        key,
        name,
        sessionKey,
        courses: new Set(),
        rubrics: new Set(),
        color: style?.color || "",
        icon: style?.icon || "",
        archivedDates: [],
        total: 0,
      });
    }
    const g = groups.get(key);
    g.total += 1;
    if (s.archivedAt) g.archivedDates.push(new Date(s.archivedAt));
    enrollments.push({ student: str(s._id), groupKey: key, sessionKey, archivedAt: s.archivedAt || null });
  }

  for (const r of rubrics) {
    const names = new Set((r.groups || []).map((n) => str(n).trim()).filter(Boolean));
    if (!names.size) continue;
    for (const g of groups.values()) {
      if (!names.has(g.name)) continue;
      g.courses.add(r.course ? str(r.course) : UNSORTED);
      g.rubrics.add(str(r._id));
    }
  }

  const planned = Array.from(groups.values()).map((g) => ({
    key: g.key,
    name: g.name,
    sessionKey: g.sessionKey,
    courses: Array.from(g.courses),
    rubrics: Array.from(g.rubrics),
    color: g.color,
    icon: g.icon,
    // Le groupe est archivé seulement si tous ses élèves le sont (date la plus récente).
    archivedAt:
      g.total > 0 && g.archivedDates.length === g.total
        ? new Date(Math.max(...g.archivedDates.map((d) => d.getTime())))
        : null,
  }));

  // Les grilles sans cours sont classées dans un cours « Grilles non classées » (une grille vit toujours dans un cours).
  const orphanRubrics = rubrics.filter((r) => !r.course).map((r) => str(r._id));
  return { groups: planned, enrollments, orphanRubrics };
}

async function ensureUnsortedCourse(ownerId) {
  const existing = await Course.findOne({ createdBy: ownerId, title: UNSORTED_COURSE_TITLE });
  return existing || Course.create({ title: UNSORTED_COURSE_TITLE, createdBy: ownerId });
}

async function ensureImportSession(ownerId) {
  let session = await Session.findOne({ createdBy: ownerId, name: IMPORT_SESSION_NAME });
  if (!session) {
    const year = new Date().getFullYear();
    session = await Session.create({
      name: IMPORT_SESSION_NAME,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      autoArchive: false,
      createdBy: ownerId,
    });
  }
  return session;
}

/**
 * Avant la refonte, archiver une session archivait aussi ses cours et leurs grilles. Ces ressources sont
 * maintenant communes: on remet en service celles que l'archivage d'une session avait rangées (même date).
 */
async function restoreResourcesArchivedBySessions(ownerId) {
  const sessions = await Session.find({ createdBy: ownerId, archivedAt: { $ne: null } }).select("archivedAt").lean();
  let courses = 0;
  let rubrics = 0;
  for (const s of sessions) {
    // `session` n'existe plus dans le schéma des cours: on lit la collection telle quelle.
    const filter = { createdBy: ownerId, session: s._id, archivedAt: s.archivedAt };
    const ids = (await Course.collection.find(filter).project({ _id: 1 }).toArray()).map((c) => c._id);
    if (!ids.length) continue;
    courses += (await Course.collection.updateMany({ _id: { $in: ids } }, { $set: { archivedAt: null } })).modifiedCount;
    rubrics += (await Rubric.updateMany({ course: { $in: ids }, archivedAt: s.archivedAt }, { $set: { archivedAt: null } })).modifiedCount;
  }
  return { courses, rubrics };
}

/**
 * Crée les groupes et inscriptions d'un utilisateur d'après ses anciennes données. Sans danger à relancer:
 * rien n'est supprimé, les ajouts existants sont conservés. Marque l'utilisateur comme converti.
 */
async function migrateGroupsForOwner(ownerId) {
  const [students, rubrics, styles] = await Promise.all([
    Student.find({ createdBy: ownerId }).select("group session archivedAt").lean(),
    Rubric.find({ createdBy: ownerId }).select("course groups").lean(),
    GroupStyle.find({ createdBy: ownerId }).lean(),
  ]);
  const plan = planGroupMigration({ students, rubrics, styles });
  const restored = await restoreResourcesArchivedBySessions(ownerId);
  const result = { groups: plan.groups.length, enrollments: plan.enrollments.length, evaluations: 0, restored, unsorted: 0 };

  let unsortedCourseId = null;
  if (plan.orphanRubrics.length) {
    unsortedCourseId = (await ensureUnsortedCourse(ownerId))._id;
    const r = await Rubric.collection.updateMany(
      { _id: { $in: plan.orphanRubrics.map((id) => new mongoose.Types.ObjectId(id)) }, createdBy: ownerId, course: null },
      { $set: { course: unsortedCourseId } }
    );
    result.unsorted = r.modifiedCount;
  }

  if (plan.groups.length) {
    const needsImport = plan.groups.some((g) => g.sessionKey === NO_SESSION);
    const importSession = needsImport ? await ensureImportSession(ownerId) : null;
    const sessionId = (key) => (key === NO_SESSION ? importSession._id : key);

    const groupIdByKey = new Map();
    for (const g of plan.groups) {
      const doc = await Group.findOneAndUpdate(
        { createdBy: ownerId, session: sessionId(g.sessionKey), name: g.name },
        {
          $setOnInsert: { color: g.color, icon: g.icon, archivedAt: g.archivedAt },
          $addToSet: { rubrics: { $each: g.rubrics }, courses: { $each: g.courses.filter((c) => c !== UNSORTED).concat(g.courses.includes(UNSORTED) && unsortedCourseId ? [unsortedCourseId] : []) } },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      groupIdByKey.set(g.key, doc._id);
    }

    const ops = plan.enrollments.map((e) => ({
      updateOne: {
        filter: { student: e.student, session: sessionId(e.sessionKey) },
        update: {
          $setOnInsert: { group: groupIdByKey.get(e.groupKey), archivedAt: e.archivedAt, createdBy: ownerId },
        },
        upsert: true,
      },
    }));
    await Enrollment.bulkWrite(ops, { ordered: false });

    // Contexte des anciennes évaluations: groupe et session de l'inscription de l'élève.
    const enrollments = await Enrollment.find({ createdBy: ownerId }).select("student group session").lean();
    const evalOps = enrollments.map((e) => ({
      updateMany: {
        filter: { owner: ownerId, studentId: e.student, group: null },
        update: { $set: { group: e.group, session: e.session } },
      },
    }));
    const evalResult = evalOps.length ? await Evaluation.bulkWrite(evalOps, { ordered: false }) : { modifiedCount: 0 };
    result.evaluations = evalResult.modifiedCount || 0;
  }

  await User.updateOne({ _id: ownerId }, { $set: { groupsMigratedAt: new Date() } });
  return result;
}

/** Convertit les utilisateurs qui ne l'ont pas encore été (au démarrage du serveur); sans effet ensuite. */
async function migrateGroupsForPending() {
  const owners = await User.find({ groupsMigratedAt: null }).select("_id").lean();
  const out = {};
  for (const { _id } of owners) out[String(_id)] = await migrateGroupsForOwner(_id);
  return out;
}

module.exports = {
  planGroupMigration,
  migrateGroupsForOwner,
  migrateGroupsForPending,
  IMPORT_SESSION_NAME,
  UNSORTED_COURSE_TITLE,
  NO_SESSION,
  UNSORTED,
};
