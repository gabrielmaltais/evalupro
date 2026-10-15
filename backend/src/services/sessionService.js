const Session = require("../models/Session");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const Evaluation = require("../models/Evaluation");
const User = require("../models/User");
const { shouldAutoArchive, todayStr, sessionStatus } = require("../utils/sessionDates");

/**
 * Archive une session et son contenu (groupes et inscriptions). Les cours, grilles et fiches d'élèves
 * sont des ressources communes: ils ne bougent pas. Seuls les éléments encore actifs reçoivent la date
 * d'archivage de la session: à la restauration, on ne remet donc en service que ce que cette archive a rangé.
 */
async function archiveSession(session, by = "manual") {
  const when = new Date();
  session.archivedAt = when;
  session.archivedBy = by;
  await session.save();
  const filter = { session: session._id, archivedAt: null };
  const [groups, enrollments] = await Promise.all([
    Group.updateMany(filter, { $set: { archivedAt: when } }),
    Enrollment.updateMany(filter, { $set: { archivedAt: when } }),
  ]);
  // Si c'était la session active, l'utilisateur retombe sur la session la plus pertinente.
  await User.updateOne({ _id: session.createdBy, activeSession: session._id }, { $set: { activeSession: null } });
  return { groups: groups.modifiedCount, students: enrollments.modifiedCount };
}

async function restoreSession(session) {
  const when = session.archivedAt;
  session.archivedAt = null;
  session.archivedBy = "";
  await session.save();
  if (!when) return { groups: 0, students: 0 };
  const filter = { session: session._id, archivedAt: when };
  const [groups, enrollments] = await Promise.all([
    Group.updateMany(filter, { $set: { archivedAt: null } }),
    Enrollment.updateMany(filter, { $set: { archivedAt: null } }),
  ]);
  return { groups: groups.modifiedCount, students: enrollments.modifiedCount };
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

/**
 * Session sur laquelle travaille l'utilisateur: celle qu'il a choisie si elle est encore active, sinon
 * la session en cours (ou la plus récente à venir/en délai de grâce); null s'il n'en a aucune.
 */
async function resolveActiveSession(user, today = todayStr()) {
  if (user.activeSession) {
    const chosen = await Session.findOne({ _id: user.activeSession, createdBy: user._id, archivedAt: null });
    if (chosen) return chosen;
  }
  const open = await Session.find({ createdBy: user._id, archivedAt: null }).sort({ startDate: -1 });
  if (!open.length) return null;
  return (
    open.find((s) => sessionStatus(s, today) === "ongoing") ||
    open.find((s) => sessionStatus(s, today) === "grace") ||
    open[0]
  );
}

/** Nombre d'évaluations liées à des sessions (pour avertir avant une suppression). */
async function countSessionEvaluations(ownerId, sessionId) {
  return Evaluation.countDocuments({ owner: ownerId, session: sessionId });
}

module.exports = { archiveSession, restoreSession, autoArchiveExpiredSessions, resolveActiveSession, countSessionEvaluations };
