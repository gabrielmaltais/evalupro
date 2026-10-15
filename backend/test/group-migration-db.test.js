const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../src/models/User");
const Session = require("../src/models/Session");
const Course = require("../src/models/Course");
const Rubric = require("../src/models/Rubric");
const Student = require("../src/models/Student");
const Evaluation = require("../src/models/Evaluation");
const GroupStyle = require("../src/models/GroupStyle");
const Group = require("../src/models/Group");
const Enrollment = require("../src/models/Enrollment");
const { migrateGroupsForOwner, migrateGroupsForPending, IMPORT_SESSION_NAME, UNSORTED_COURSE_TITLE } = require("../src/services/groupMigration");

let mongod;
test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

const oid = () => new mongoose.Types.ObjectId();

/** Données telles qu'avant la refonte: groupe en texte sur l'élève, grilles avec « groupes visés », cours rattachés à la session. */
async function seed() {
  const user = await User.create({ name: "Prof", email: "p@example.com", password: "Password123!" });
  const other = await User.create({ name: "Autre", email: "o@example.com", password: "Password123!" });
  const archivedAt = new Date("2026-05-01T00:00:00Z");
  const session = await Session.create({ name: "A26", startDate: "2026-08-24", endDate: "2026-12-20", createdBy: user._id });
  const oldSession = await Session.create({
    name: "H25", startDate: "2025-01-10", endDate: "2025-05-10", archivedAt, archivedBy: "manual", createdBy: user._id,
  });
  const course = await Course.create({ title: "Réseaux", createdBy: user._id });
  const archivedCourse = await Course.create({ title: "Ancien cours", archivedAt, createdBy: user._id });
  await Course.collection.updateOne({ _id: archivedCourse._id }, { $set: { session: oldSession._id } });
  const linked = await Rubric.create({
    title: "Examen 1", taskTitle: "E1", version: 1, course: course._id, criteria: [], createdBy: user._id,
  });
  await Rubric.collection.updateOne({ _id: linked._id }, { $set: { groups: ["A1"] } });
  const oldRubric = await Rubric.create({
    title: "Vieil examen", taskTitle: "E0", version: 1, course: archivedCourse._id, criteria: [], archivedAt, createdBy: user._id,
  });
  const orphanId = oid();
  await Rubric.collection.insertOne({
    _id: orphanId, title: "TP libre", taskTitle: "TP", version: 1, criteria: [], groups: ["A1"], archivedAt: null,
    createdBy: user._id, createdAt: new Date(), updatedAt: new Date(),
  });
  const mk = (extra) => ({ _id: oid(), createdBy: user._id, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), ...extra });
  const s1 = mk({ name: "Ana Roy", group: "A1", session: session._id });
  const s2 = mk({ name: "Luc Roy", group: "B2" });
  const s3 = mk({ name: "Sans Groupe" });
  const foreign = { ...mk({ name: "Etranger", group: "A1" }), createdBy: other._id };
  await Student.collection.insertMany([s1, s2, s3, foreign]);
  await GroupStyle.create({ groupKey: "A1", color: "#00aa00", icon: "fa-users", createdBy: user._id });
  const ev = await Evaluation.create({
    studentName: "Ana Roy", studentId: s1._id, date: "2026-10-01", rubric: linked._id, owner: user._id,
  });
  return { user, other, session, course, archivedCourse, linked, oldRubric, orphanId, s1, s2, s3, foreign, ev };
}

test("crée groupes, inscriptions et contexte des évaluations", async () => {
  const d = await seed();
  const res = await migrateGroupsForOwner(d.user._id);
  assert.equal(res.groups, 2);
  assert.equal(res.enrollments, 2);
  assert.equal(res.evaluations, 1);

  const unsorted = await Course.findOne({ createdBy: d.user._id, title: UNSORTED_COURSE_TITLE });
  assert.ok(unsorted);
  const a1 = await Group.findOne({ createdBy: d.user._id, name: "A1" });
  assert.equal(String(a1.session), String(d.session._id));
  assert.deepEqual(a1.courses.map(String).sort(), [String(d.course._id), String(unsorted._id)].sort());
  assert.deepEqual(a1.rubrics.map(String).sort(), [String(d.linked._id), String(d.orphanId)].sort());
  assert.equal(a1.color, "#00aa00");

  const importSession = await Session.findOne({ createdBy: d.user._id, name: IMPORT_SESSION_NAME });
  assert.ok(importSession);
  const b2 = await Group.findOne({ createdBy: d.user._id, name: "B2" });
  assert.equal(String(b2.session), String(importSession._id));
  assert.equal(b2.courses.length, 0);

  assert.equal(await Enrollment.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Enrollment.countDocuments({ student: d.s3._id }), 0);

  const ev = await Evaluation.findById(d.ev._id);
  assert.equal(String(ev.group), String(a1._id));
  assert.equal(String(ev.session), String(d.session._id));

  // La grille sans cours est classée dans « Grilles non classées ».
  const orphan = await Rubric.findById(d.orphanId);
  assert.equal(String(orphan.course), String(unsorted._id));

  // Ce que l'archivage d'une session avait rangé (cours et grilles) est remis en service.
  assert.equal((await Course.findById(d.archivedCourse._id)).archivedAt, null);
  assert.equal((await Rubric.findById(d.oldRubric._id)).archivedAt, null);

  // Les données des autres utilisateurs sont ignorées.
  assert.equal(await Group.countDocuments({ createdBy: d.other._id }), 0);
  assert.ok((await User.findById(d.user._id)).groupsMigratedAt);
});

test("relancer la migration ne duplique rien", async () => {
  const d = await seed();
  await migrateGroupsForOwner(d.user._id);
  const again = await migrateGroupsForOwner(d.user._id);
  assert.equal(again.evaluations, 0);
  assert.equal(again.unsorted, 0);
  assert.equal(await Group.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Enrollment.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Session.countDocuments({ createdBy: d.user._id, name: IMPORT_SESSION_NAME }), 1);
  assert.equal(await Course.countDocuments({ createdBy: d.user._id, title: UNSORTED_COURSE_TITLE }), 1);
});

test("au démarrage, seuls les utilisateurs pas encore convertis le sont", async () => {
  const d = await seed();
  const first = await migrateGroupsForPending();
  assert.ok(first[String(d.user._id)]);
  // Un groupe supprimé ensuite n'est pas recréé au prochain démarrage.
  await Group.deleteOne({ createdBy: d.user._id, name: "B2" });
  const second = await migrateGroupsForPending();
  assert.deepEqual(second, {});
  assert.equal(await Group.countDocuments({ createdBy: d.user._id, name: "B2" }), 0);
});
