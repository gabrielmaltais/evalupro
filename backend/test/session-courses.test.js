const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { backfillSessionCourses } = require("../src/services/sessionCourseService");
const Session = require("../src/models/Session");

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
  const reg = await request(app).post("/api/auth/register").send({ name: "Test", email, password: "Password123!" });
  return { Authorization: `Bearer ${reg.body.token}` };
}
const post = (h, url, body) => request(app).post(url).set(h).send(body);
const put = (h, url, body) => request(app).put(url).set(h).send(body);
const get = (h, url) => request(app).get(url).set(h);

const rubricBody = (title, course, isActive) => ({
  title,
  taskTitle: "Examen",
  version: 1,
  course,
  isActive,
  criteria: [{ id: "c1", title: "Critère", weight: 10 }],
});

async function setup(h) {
  const s = (await post(h, "/api/sessions", { name: "A26", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  const c = (await post(h, "/api/courses", { title: "Réseaux" })).body;
  const old = (await post(h, "/api/rubrics", rubricBody("Vieil examen", c._id, false))).body;
  const cur = (await post(h, "/api/rubrics", rubricBody("Examen 1", c._id, true))).body;
  return { s, c, old, cur };
}

test("ajouter un cours importe par défaut les évaluations actives seulement", async () => {
  const h = await login("a@example.com");
  const { s, c, old, cur } = await setup(h);
  const add = await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id });
  assert.equal(add.statusCode, 201);
  const [entry] = add.body;
  const by = Object.fromEntries(entry.rubrics.map((r) => [r.title, r.imported]));
  assert.deepEqual(by, { "Vieil examen": false, "Examen 1": true });
  assert.ok(old && cur);
});

test("les évaluations importées arrivent dans les groupes qui suivent le cours (donc en correction)", async () => {
  const h = await login("b@example.com");
  const { s, c, old, cur } = await setup(h);
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id });
  const g = (await post(h, "/api/groups", { name: "G1", courses: [c._id] })).body;
  let detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.deepEqual(detail.rubrics.map((r) => r._id), [cur._id]);

  // Cocher l'ancienne évaluation et décocher l'actuelle.
  const upd = await put(h, `/api/sessions/${s._id}/courses/${c._id}`, { rubricIds: [old._id] });
  assert.equal(upd.statusCode, 200);
  detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.deepEqual(detail.rubrics.map((r) => r._id), [old._id]);

  const del = await request(app).delete(`/api/sessions/${s._id}/courses/${c._id}`).set(h);
  assert.equal(del.statusCode, 200);
  detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.equal(detail.rubrics.length, 0);
  assert.equal(detail.courses.length, 0);
});

test("lier un cours à un groupe l'ajoute à la session", async () => {
  const h = await login("c@example.com");
  const { s, c, cur } = await setup(h);
  const g = (await post(h, "/api/groups", { name: "G1" })).body;
  await put(h, `/api/groups/${g._id}`, { courses: [c._id] });
  const list = (await get(h, `/api/sessions/${s._id}/courses`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].groups.length, 1);
  assert.deepEqual((await get(h, `/api/groups/${g._id}`)).body.rubrics.map((r) => r._id), [cur._id]);
});

test("une copie de session garde les cours, sans les évaluations par défaut", async () => {
  const h = await login("d@example.com");
  const { s, c } = await setup(h);
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id });
  await post(h, "/api/groups", { name: "G1", courses: [c._id] });
  const copy = await post(h, `/api/sessions/${s._id}/copy`, { name: "H27", startDate: "2027-01-10", endDate: "2099-12-20" });
  assert.equal(copy.statusCode, 201);
  const list = (await get(h, `/api/sessions/${copy.body.session._id}/courses`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].rubrics.filter((r) => r.imported).length, 0);
});

test("le rattrapage déduit les cours d'une session existante, une seule fois", async () => {
  const h = await login("e@example.com");
  const { s, c, cur } = await setup(h);
  const g = (await post(h, "/api/groups", { name: "G1", courses: [c._id] })).body;
  await Session.updateOne({ _id: s._id }, { $set: { courses: [] } });
  await mongoose.connection.db.collection("groups").updateOne({ _id: new mongoose.Types.ObjectId(g._id) }, { $set: { rubrics: [new mongoose.Types.ObjectId(cur._id)] } });
  assert.equal(await backfillSessionCourses(), 1);
  assert.equal(await backfillSessionCourses(), 0);
  const list = (await get(h, `/api/sessions/${s._id}/courses`)).body;
  assert.deepEqual(list[0].rubrics.filter((r) => r.imported).map((r) => r._id), [cur._id]);
});

test("les données d'un autre utilisateur restent inaccessibles", async () => {
  const h = await login("f@example.com");
  const other = await login("g@example.com");
  const { s, c } = await setup(h);
  assert.equal((await get(other, `/api/sessions/${s._id}/courses`)).statusCode, 404);
  const mineSession = (await post(other, "/api/sessions", { name: "X", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  assert.equal((await post(other, `/api/sessions/${mineSession._id}/courses`, { courseId: c._id })).statusCode, 404);
});
