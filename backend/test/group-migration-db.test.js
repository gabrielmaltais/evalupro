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
const { migrateGroupsForOwner, IMPORT_SESSION_NAME } = require("../src/services/groupMigration");

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

async function seed() {
  const user = await User.create({ name: "Prof", email: "p@example.com", password: "Password123!" });
  const other = await User.create({ name: "Autre", email: "o@example.com", password: "Password123!" });
  const session = await Session.create({ name: "A26", startDate: "2026-08-24", endDate: "2026-12-20", createdBy: user._id });
  const course = await Course.create({ title: "Réseaux", createdBy: user._id });
  const linked = await Rubric.create({
    title: "Examen 1", taskTitle: "E1", version: 1, course: course._id, groups: ["A1"], criteria: [], createdBy: user._id,
  });
  const direct = await Rubric.create({
    title: "TP libre", taskTitle: "TP", version: 1, groups: ["A1"], criteria: [], createdBy: user._id,
  });
  const s1 = await Student.create({ name: "Ana Roy", group: "A1", session: session._id, createdBy: user._id });
  const s2 = await Student.create({ name: "Luc Roy", group: "B2", createdBy: user._id });
  const s3 = await Student.create({ name: "Sans Groupe", createdBy: user._id });
  const foreign = await Student.create({ name: "Etranger", group: "A1", createdBy: other._id });
  await GroupStyle.create({ groupKey: "A1", color: "#00aa00", icon: "fa-users", createdBy: user._id });
  const ev = await Evaluation.create({
    studentName: "Ana Roy", studentId: s1._id, date: "2026-10-01", rubric: linked._id, owner: user._id,
  });
  return { user, other, session, course, linked, direct, s1, s2, s3, foreign, ev };
}

test("crée groupes, inscriptions et contexte des évaluations", async () => {
  const d = await seed();
  const res = await migrateGroupsForOwner(d.user._id);
  assert.deepEqual(res, { groups: 2, enrollments: 2, evaluations: 1 });

  const a1 = await Group.findOne({ createdBy: d.user._id, name: "A1" });
  assert.equal(String(a1.session), String(d.session._id));
  assert.deepEqual(a1.courses.map(String), [String(d.course._id)]);
  assert.deepEqual(a1.extraRubrics.map(String), [String(d.direct._id)]);
  assert.equal(a1.color, "#00aa00");

  const importSession = await Session.findOne({ createdBy: d.user._id, name: IMPORT_SESSION_NAME });
  assert.ok(importSession);
  const b2 = await Group.findOne({ createdBy: d.user._id, name: "B2" });
  assert.equal(String(b2.session), String(importSession._id));

  assert.equal(await Enrollment.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Enrollment.countDocuments({ student: d.s3._id }), 0);

  const ev = await Evaluation.findById(d.ev._id);
  assert.equal(String(ev.group), String(a1._id));
  assert.equal(String(ev.session), String(d.session._id));

  // Les données des autres utilisateurs sont ignorées.
  assert.equal(await Group.countDocuments({ createdBy: d.other._id }), 0);
});

test("relancer la migration ne duplique rien", async () => {
  const d = await seed();
  await migrateGroupsForOwner(d.user._id);
  const again = await migrateGroupsForOwner(d.user._id);
  assert.equal(again.evaluations, 0);
  assert.equal(await Group.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Enrollment.countDocuments({ createdBy: d.user._id }), 2);
  assert.equal(await Session.countDocuments({ createdBy: d.user._id, name: IMPORT_SESSION_NAME }), 1);
});
