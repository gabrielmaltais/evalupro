const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../src/models/User");
const Student = require("../src/models/Student");
const Rubric = require("../src/models/Rubric");
const Evaluation = require("../src/models/Evaluation");
const EvaluationEmailDelivery = require("../src/models/EvaluationEmailDelivery");
const { encryptSecret, decryptSecret } = require("../src/services/smtpConfigService");

let mongod;

test.before(async () => {
  process.env.SMTP_CONFIG_ENCRYPTION_KEY = "smtp-encryption-key-for-tests";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Rubric.deleteMany({}),
    Evaluation.deleteMany({}),
    EvaluationEmailDelivery.deleteMany({}),
  ]);
});

test("chiffrement/dechiffrement SMTP", async () => {
  const raw = "super-secret-password";
  const encrypted = encryptSecret(raw);
  assert.notEqual(encrypted, raw);
  assert.equal(decryptSecret(encrypted), raw);
});

test("anti-doublon des livraisons sur evaluation+student+exam+owner", async () => {
  await EvaluationEmailDelivery.init();
  const user = await User.create({ name: "Admin", email: "admin", password: "AdminPro1", role: "admin" });
  const student = await Student.create({ name: "Alice", email: "alice@x.com", group: "G1", createdBy: user._id });
  const rubric = await Rubric.create({
    title: "Reseau",
    taskTitle: "Examen 1",
    version: 1,
    criteria: [{ id: "c1", title: "Critere", weight: 10, levels: [{ label: "ok", maxPct: 1, desc: "ok" }] }],
    createdBy: user._id,
  });
  const evaluation = await Evaluation.create({
    studentName: "Alice",
    studentId: student._id,
    date: "2026-04-08",
    rubric: rubric._id,
    owner: user._id,
  });

  await EvaluationEmailDelivery.create({
    evaluationId: evaluation._id,
    studentId: student._id,
    group: "G1",
    examKey: `${rubric._id}:1`,
    jobId: "job1",
    owner: user._id,
  });

  await assert.rejects(
    EvaluationEmailDelivery.create({
      evaluationId: evaluation._id,
      studentId: student._id,
      group: "G1",
      examKey: `${rubric._id}:1`,
      jobId: "job2",
      owner: user._id,
    })
  );
});
