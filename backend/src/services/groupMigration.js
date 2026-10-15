const Student = require("../models/Student");
const Rubric = require("../models/Rubric");
const Session = require("../models/Session");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const GroupStyle = require("../models/GroupStyle");
const Evaluation = require("../models/Evaluation");

const IMPORT_SESSION_NAME = "Import (groupes sans session)";
const NO_SESSION = "none";

const str = (v) => (v == null ? "" : String(v));

/**
 * Calcule, sans toucher à la base, les groupes et inscriptions à créer d'après les anciennes données
 * (nom de groupe en texte sur l'élève, « groupes visés » des grilles, GroupStyle).
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
        extraRubrics: new Set(),
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
      if (r.course) g.courses.add(str(r.course));
      else g.extraRubrics.add(str(r._id));
    }
  }

  const planned = Array.from(groups.values()).map((g) => ({
    key: g.key,
    name: g.name,
    sessionKey: g.sessionKey,
    courses: Array.from(g.courses),
    extraRubrics: Array.from(g.extraRubrics),
    color: g.color,
    icon: g.icon,
    // Le groupe est archivé seulement si tous ses élèves le sont (date la plus récente).
    archivedAt:
      g.total > 0 && g.archivedDates.length === g.total
        ? new Date(Math.max(...g.archivedDates.map((d) => d.getTime())))
        : null,
  }));

  return { groups: planned, enrollments };
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
 * Crée les groupes et inscriptions d'un utilisateur d'après ses anciennes données. Sans danger à relancer:
 * rien n'est supprimé ni modifié dans les anciens champs, les ajouts existants sont conservés.
 */
async function migrateGroupsForOwner(ownerId) {
  const [students, rubrics, styles] = await Promise.all([
    Student.find({ createdBy: ownerId }).select("group session archivedAt").lean(),
    Rubric.find({ createdBy: ownerId }).select("course groups").lean(),
    GroupStyle.find({ createdBy: ownerId }).lean(),
  ]);
  const plan = planGroupMigration({ students, rubrics, styles });
  if (!plan.groups.length) return { groups: 0, enrollments: 0, evaluations: 0 };

  const needsImport = plan.groups.some((g) => g.sessionKey === NO_SESSION);
  const importSession = needsImport ? await ensureImportSession(ownerId) : null;
  const sessionId = (key) => (key === NO_SESSION ? importSession._id : key);

  const groupIdByKey = new Map();
  for (const g of plan.groups) {
    const doc = await Group.findOneAndUpdate(
      { createdBy: ownerId, session: sessionId(g.sessionKey), name: g.name },
      {
        $setOnInsert: { color: g.color, icon: g.icon, archivedAt: g.archivedAt },
        $addToSet: { courses: { $each: g.courses }, extraRubrics: { $each: g.extraRubrics } },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    groupIdByKey.set(g.key, doc._id);
  }

  const ops = plan.enrollments.map((e) => ({
    updateOne: {
      filter: { student: e.student, session: sessionId(e.sessionKey) },
      update: {
        $setOnInsert: {
          group: groupIdByKey.get(e.groupKey),
          archivedAt: e.archivedAt,
          createdBy: ownerId,
        },
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

  return { groups: plan.groups.length, enrollments: plan.enrollments.length, evaluations: evalResult.modifiedCount || 0 };
}

async function migrateGroupsForAll() {
  const owners = await Student.distinct("createdBy");
  const out = {};
  for (const ownerId of owners) out[String(ownerId)] = await migrateGroupsForOwner(ownerId);
  return out;
}

module.exports = { planGroupMigration, migrateGroupsForOwner, migrateGroupsForAll, IMPORT_SESSION_NAME, NO_SESSION };
