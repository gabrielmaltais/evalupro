const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidDateStr,
  addDays,
  archiveAfterDate,
  shouldAutoArchive,
  sessionStatus,
  validateSessionDates,
} = require("../src/utils/sessionDates");

const session = { startDate: "2026-08-25", endDate: "2026-12-18", graceDays: 7, autoArchive: true, archivedAt: null };

test("valide les dates réelles seulement", () => {
  assert.equal(isValidDateStr("2026-12-18"), true);
  assert.equal(isValidDateStr("2026-02-30"), false);
  assert.equal(isValidDateStr("18/12/2026"), false);
  assert.equal(isValidDateStr(undefined), false);
});

test("calcule le dernier jour avant l'archivage, y compris au passage d'année", () => {
  assert.equal(addDays("2026-12-30", 5), "2027-01-04");
  assert.equal(archiveAfterDate(session), "2026-12-25");
  assert.equal(archiveAfterDate({ endDate: "2026-12-18" }), "2026-12-18");
  assert.equal(archiveAfterDate({}), null);
});

test("archive automatiquement seulement après la fin et le délai de grâce", () => {
  assert.equal(shouldAutoArchive(session, "2026-12-18"), false);
  assert.equal(shouldAutoArchive(session, "2026-12-25"), false);
  assert.equal(shouldAutoArchive(session, "2026-12-26"), true);
  assert.equal(shouldAutoArchive({ ...session, autoArchive: false }, "2027-06-01"), false);
  assert.equal(shouldAutoArchive({ ...session, archivedAt: new Date() }, "2027-06-01"), false);
  assert.equal(shouldAutoArchive({ ...session, graceDays: 0 }, "2026-12-19"), true);
});

test("statut d'une session selon la date du jour", () => {
  assert.equal(sessionStatus(session, "2026-08-01"), "upcoming");
  assert.equal(sessionStatus(session, "2026-10-01"), "ongoing");
  assert.equal(sessionStatus(session, "2026-12-18"), "ongoing");
  assert.equal(sessionStatus(session, "2026-12-20"), "grace");
  assert.equal(sessionStatus(session, "2027-01-02"), "due");
  assert.equal(sessionStatus({ ...session, archivedAt: new Date() }, "2026-10-01"), "archived");
});

test("refuse une plage de dates incohérente", () => {
  assert.equal(validateSessionDates("2026-08-25", "2026-12-18"), null);
  assert.match(validateSessionDates("2026-12-18", "2026-08-25"), /après/);
  assert.match(validateSessionDates("", "2026-08-25"), /début/);
});
