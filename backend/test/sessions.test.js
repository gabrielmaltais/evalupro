const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");

let mongod;
test.before(async () => {
  process.env.JWT_SECRET = "test-secret";
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

async function login(email) {
  const reg = await request(app).post("/api/auth/register").send({ name: "T", email, password: "Password123!" });
  assert.equal(reg.statusCode, 201);
  return { Authorization: `Bearer ${reg.body.token}` };
}

const rubricBody = (title) => ({
  title,
  taskTitle: "Examen",
  version: 1,
  criteria: [{ id: "c1", title: "Critère", weight: 10 }],
});

test("archive puis restaure une session avec ses éléments", async () => {
  const h = await login("a@example.com");
  const s = await request(app).post("/api/sessions").set(h).send({ name: "A26", startDate: "2026-08-24", endDate: "2026-12-20" });
  assert.equal(s.statusCode, 201);
  const c = await request(app).post("/api/courses").set(h).send({ title: "Réseaux", session: s.body._id });
  const r = await request(app).post("/api/rubrics").set(h).send({ ...rubricBody("Examen 1"), course: c.body._id, archiveWithCourse: true });
  const keep = await request(app).post("/api/rubrics").set(h).send({ ...rubricBody("Persistante"), course: c.body._id, archiveWithCourse: false });
  assert.equal(c.statusCode, 201);
  assert.equal(r.statusCode, 201);
  assert.equal(keep.statusCode, 201);
  // Un cours déjà archivé à la main ne doit pas être restauré avec la session.
  const c2 = await request(app).post("/api/courses").set(h).send({ title: "Ancien", session: s.body._id });
  await request(app).post(`/api/courses/${c2.body._id}/archive`).set(h);

  const arch = await request(app).post(`/api/sessions/${s.body._id}/archive`).set(h);
  assert.equal(arch.statusCode, 200);
  assert.equal(arch.body.archived.courses, 1);
  assert.equal((await request(app).get("/api/courses").set(h)).body.length, 0);
  // La grille archivée avec le cours disparaît; la grille persistante reste active.
  assert.deepEqual((await request(app).get("/api/rubrics").set(h)).body.map((x) => x.title), ["Persistante"]);
  assert.equal((await request(app).get("/api/courses?archived=1").set(h)).body.length, 2);

  const rest = await request(app).post(`/api/sessions/${s.body._id}/restore`).set(h);
  assert.equal(rest.statusCode, 200);
  const active = (await request(app).get("/api/courses").set(h)).body;
  assert.deepEqual(active.map((x) => x.title), ["Réseaux"]);
  assert.equal((await request(app).get("/api/rubrics").set(h)).body.length, 2);
});

test("archivage automatique d'une session échue", async () => {
  const h = await login("b@example.com");
  await request(app).post("/api/sessions").set(h).send({ name: "Vieille", startDate: "2020-01-10", endDate: "2020-05-10" });
  const list = await request(app).get("/api/sessions").set(h);
  assert.equal(list.body[0].status, "archived");
  assert.equal(list.body[0].archivedBy, "auto");
});

test("les grilles sont propres à chaque utilisateur", async () => {
  const a = await login("c@example.com");
  const b = await login("d@example.com");
  const r = await request(app).post("/api/rubrics").set(a).send(rubricBody("Privée"));
  assert.equal((await request(app).get("/api/rubrics").set(b)).body.length, 0);
  assert.equal((await request(app).put(`/api/rubrics/${r.body._id}`).set(b).send({ title: "x" })).statusCode, 404);
  assert.equal((await request(app).post(`/api/rubrics/${r.body._id}/archive`).set(b)).statusCode, 404);
});

test("copie d'une session vers de nouveaux groupes", async () => {
  const h = await login("e@example.com");
  const s = await request(app).post("/api/sessions").set(h).send({ name: "A25", startDate: "2025-08-24", endDate: "2099-12-20" });
  const c = await request(app).post("/api/courses").set(h).send({ title: "Réseaux", session: s.body._id, competencies: [{ title: "Analyser" }] });
  const r = await request(app).post("/api/rubrics").set(h).send({ ...rubricBody("Examen"), course: c.body._id, archiveWithCourse: true });
  const copy = await request(app).post(`/api/sessions/${s.body._id}/copy`).set(h).send({
    name: "A26", startDate: "2026-08-24", endDate: "2099-12-20", courseIds: [c.body._id], rubricIds: [r.body._id], groups: ["G1"],
  });
  assert.equal(copy.statusCode, 201);
  assert.deepEqual(copy.body.copied, { courses: 1, rubrics: 1 });
  const rubrics = (await request(app).get("/api/rubrics").set(h)).body;
  const newCourse = (await request(app).get("/api/courses").set(h)).body.find((x) => x.session === copy.body.session._id);
  const copied = rubrics.find((x) => x.course === newCourse._id);
  assert.deepEqual(copied.groups, ["G1"]);
  assert.equal(copied.archiveWithCourse, true);
  assert.equal(copied.version, 1);
});

test("groupe archivé: exclu du tableau et restaurable", async () => {
  const h = await login("f@example.com");
  await request(app).post("/api/students").set(h).send({ name: "Al Bo", group: "G1" });
  await request(app).post("/api/students/groups/archive").set(h).send({ group: "G1" });
  assert.equal((await request(app).get("/api/students/group-dashboard").set(h)).body.length, 0);
  assert.equal((await request(app).get("/api/students/groups/archived").set(h)).body[0].group, "G1");
  await request(app).post("/api/students/groups/restore").set(h).send({ group: "G1" });
  assert.equal((await request(app).get("/api/students").set(h)).body.length, 1);
});
