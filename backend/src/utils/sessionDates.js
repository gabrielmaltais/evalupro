/** Dates de session au format AAAA-MM-JJ (comparables comme du texte, sans décalage de fuseau). */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function todayStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Dernier jour avant l'archivage automatique : fin de session + délai de grâce. */
function archiveAfterDate(session) {
  if (!isValidDateStr(session?.endDate)) return null;
  return addDays(session.endDate, Math.max(0, Number(session.graceDays) || 0));
}

function shouldAutoArchive(session, today = todayStr()) {
  if (!session || session.archivedAt || session.autoArchive === false) return false;
  const last = archiveAfterDate(session);
  return Boolean(last) && today > last;
}

/** upcoming | ongoing | grace | archived | due (échue, en attente d'archivage) */
function sessionStatus(session, today = todayStr()) {
  if (session?.archivedAt) return "archived";
  if (isValidDateStr(session?.startDate) && today < session.startDate) return "upcoming";
  if (!isValidDateStr(session?.endDate) || today <= session.endDate) return "ongoing";
  const last = archiveAfterDate(session);
  return last && today <= last ? "grace" : "due";
}

/** Retourne un message d'erreur, ou null si les dates sont cohérentes. */
function validateSessionDates(startDate, endDate) {
  if (!isValidDateStr(startDate)) return "Date de début invalide.";
  if (!isValidDateStr(endDate)) return "Date de fin invalide.";
  if (endDate < startDate) return "La date de fin doit être après la date de début.";
  return null;
}

module.exports = { isValidDateStr, addDays, todayStr, archiveAfterDate, shouldAutoArchive, sessionStatus, validateSessionDates };
