const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { backfillSessionCourses, migrateEntryGroups } = require("../src/services/sessionCourseService");
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

const group = async (h, name) => (await post(h, "/api/groups", { name })).body;
const entryOf = async (h, s) => (await get(h, `/api/sessions/${s._id}/courses`)).body;

test("les évaluations cochées arrivent dans les groupes du cours (donc en correction)", async () => {
  const h = await login("b@example.com");
  const { s, c, old, cur } = await setup(h);
  const g = await group(h, "G1");
  const add = await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g._id] });
  assert.equal(add.statusCode, 201);
  const entry = add.body[0];
  let detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.deepEqual(detail.rubrics.map((r) => r._id), [cur._id]);

  // Cocher l'ancienne évaluation et décocher l'actuelle.
  const upd = await put(h, `/api/sessions/${s._id}/courses/${entry._id}`, { rubricIds: [old._id] });
  assert.equal(upd.statusCode, 200);
  detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.deepEqual(detail.rubrics.map((r) => r._id), [old._id]);

  const del = await request(app).delete(`/api/sessions/${s._id}/courses/${entry._id}`).set(h);
  assert.equal(del.statusCode, 200);
  detail = (await get(h, `/api/groups/${g._id}`)).body;
  assert.equal(detail.rubrics.length, 0);
  assert.equal(detail.courseList.length, 0);
});

test("le même cours peut être donné plusieurs fois, chaque fois à d'autres groupes, jamais deux fois au même", async () => {
  const h = await login("multi@example.com");
  const { s, c, cur } = await setup(h);
  const g1 = await group(h, "G1");
  const g2 = await group(h, "G2");
  assert.equal((await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g1._id] })).statusCode, 201);
  assert.equal((await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g2._id] })).statusCode, 201);
  const list = await entryOf(h, s);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((e) => e.groups.map((g) => g.name)), [["G1"], ["G2"]]);
  // G1 ne peut pas suivre le même cours une seconde fois.
  assert.equal((await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g1._id] })).statusCode, 409);
  assert.equal((await put(h, `/api/sessions/${s._id}/courses/${list[1]._id}`, { groupIds: [g1._id, g2._id] })).statusCode, 409);
  // Chaque groupe garde ses évaluations; un groupe hors session est refusé.
  assert.deepEqual((await get(h, `/api/groups/${g2._id}`)).body.rubrics.map((r) => r._id), [cur._id]);
  assert.equal((await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: ["64b000000000000000000000"] })).statusCode, 400);
  // Groupe jumelé (exception): deux groupes sur la même ligne, autorisé.
  const g3 = await group(h, "G3");
  const g4 = await group(h, "G4");
  assert.equal((await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g3._id, g4._id] })).statusCode, 201);
});

test("un groupe supprimé sort des cours et n'est plus proposé", async () => {
  const h = await login("gone@example.com");
  const { s, c } = await setup(h);
  const g = await group(h, "G1");
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g._id] });
  assert.equal((await get(h, "/api/common-groups")).body.length, 1);
  assert.equal((await request(app).delete(`/api/groups/${g._id}`).set(h)).statusCode, 204);
  assert.deepEqual((await entryOf(h, s))[0].groups, []);
  assert.equal((await get(h, "/api/common-groups")).body.length, 0);
});

test("les copies corrigées sont comptées par ligne de cours et une évaluation décochée reste suivie", async () => {
  const h = await login("count@example.com");
  const { s, c, cur } = await setup(h);
  const g1 = await group(h, "G1");
  const g2 = await group(h, "G2");
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g1._id] });
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g2._id] });
  const st = (await post(h, `/api/groups/${g1._id}/students`, { firstName: "Ana", lastName: "Roy" })).body.student;
  const ev = await post(h, "/api/evaluations", { studentId: st._id, studentName: "Ana Roy", date: "2026-10-01", rubric: cur._id, scores: { c1: 5 } });
  assert.equal(ev.statusCode, 201, JSON.stringify(ev.body));
  const [e1, e2] = await entryOf(h, s);
  assert.equal(e1.rubrics.find((r) => r._id === cur._id).correctedCount, 1);
  assert.equal(e2.rubrics.find((r) => r._id === cur._id).correctedCount, 0, "les copies de G1 ne comptent pas pour G2");
  let targets = (await get(h, "/api/evaluations/email-targets")).body;
  assert.equal(targets.exams[0].retired, false);
  await put(h, `/api/sessions/${s._id}/courses/${e1._id}`, { rubricIds: [] });
  await put(h, `/api/sessions/${s._id}/courses/${e2._id}`, { rubricIds: [] });
  targets = (await get(h, "/api/evaluations/email-targets")).body;
  assert.equal(targets.exams[0].retired, true);
  const rubrics = (await get(h, "/api/rubrics")).body;
  assert.deepEqual(rubrics.find((r) => r._id === cur._id).groups, []);
});

test("une copie de session garde les cours de ses groupes, sans les évaluations par défaut", async () => {
  const h = await login("d@example.com");
  const { s, c } = await setup(h);
  const g = await group(h, "G1");
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c._id, groupIds: [g._id] });
  const copy = await post(h, `/api/sessions/${s._id}/copy`, { name: "H27", startDate: "2027-01-10", endDate: "2099-12-20" });
  assert.equal(copy.statusCode, 201);
  const list = (await get(h, `/api/sessions/${copy.body.session._id}/courses`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].rubrics.filter((r) => r.imported).length, 0);
  assert.deepEqual(list[0].groups.map((x) => x.name), ["G1"]);
});

test("la reprise des anciennes données: cours déduits des groupes, puis groupes reportés dans chaque ligne", async () => {
  const h = await login("e@example.com");
  const { s, c, cur } = await setup(h);
  const g = await group(h, "G1");
  await Session.updateOne({ _id: s._id }, { $set: { courses: [] } });
  const gid = new mongoose.Types.ObjectId(g._id);
  await mongoose.connection.db.collection("groups").updateOne({ _id: gid }, { $set: { courses: [new mongoose.Types.ObjectId(c._id)], rubrics: [new mongoose.Types.ObjectId(cur._id)] } });
  assert.equal(await backfillSessionCourses(), 1);
  assert.equal(await backfillSessionCourses(), 0);
  let list = await entryOf(h, s);
  assert.deepEqual(list[0].rubrics.filter((r) => r.imported).map((r) => r._id), [cur._id]);
  assert.deepEqual(list[0].groups.map((x) => x.name), ["G1"]);

  // Ancien format: ligne sans _id ni groupes.
  await mongoose.connection.db.collection("sessions").updateOne({ _id: new mongoose.Types.ObjectId(s._id) }, { $set: { courses: [{ course: new mongoose.Types.ObjectId(c._id), rubrics: [new mongoose.Types.ObjectId(cur._id)] }] } });
  assert.equal(await migrateEntryGroups(), 1);
  assert.equal(await migrateEntryGroups(), 0);
  list = await entryOf(h, s);
  assert.deepEqual(list[0].groups.map((x) => x.name), ["G1"]);
  assert.ok(list[0]._id);
});

test("les données d'un autre utilisateur restent inaccessibles", async () => {
  const h = await login("f@example.com");
  const other = await login("g@example.com");
  const { s, c } = await setup(h);
  assert.equal((await get(other, `/api/sessions/${s._id}/courses`)).statusCode, 404);
  const mineSession = (await post(other, "/api/sessions", { name: "X", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  assert.equal((await post(other, `/api/sessions/${mineSession._id}/courses`, { courseId: c._id })).statusCode, 404);
});

test("les liens de compétence suivent le cours: changer de cours coupe les liens et sort la grille de l'ancien cours de la session", async () => {
  const h = await login("align@example.com");
  const s = (await post(h, "/api/sessions", { name: "A26", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  const c1 = (await post(h, "/api/courses", { title: "Réseaux", competencies: [{ id: "k1", title: "Installer les services" }] })).body;
  const c2 = (await post(h, "/api/courses", { title: "Python", competencies: [{ id: "k9", title: "Programmer" }] })).body;
  const crit = (extra) => [{ id: "c1", title: "Installer les services", weight: 10, ...extra }];
  const body = (course, criteria) => ({ title: "Réseaux", taskTitle: "Examen", version: 1, course, isActive: true, criteria });

  // Un id inconnu du cours est remplacé par la compétence du même titre; l'ancien nom (accents, casse) suffit.
  const r = (await post(h, "/api/rubrics", body(c1._id, crit({ competencyId: "bidon", competencyElement: "INSTALLER les services" })))).body;
  assert.equal(r.criteria[0].competencyId, "k1");
  assert.equal(r.criteria[0].competencyElement, "Installer les services");

  // Importée dans la session, puis déplacée vers un autre cours.
  await post(h, `/api/sessions/${s._id}/courses`, { courseId: c1._id });
  assert.equal((await get(h, `/api/sessions/${s._id}/courses`)).body[0].rubrics[0].imported, true);
  const moved = (await put(h, `/api/rubrics/${r._id}`, body(c2._id, r.criteria))).body;
  assert.equal(moved.criteria[0].competencyId, "", "le lien vers l'ancien cours est coupé");
  assert.equal(moved.criteria[0].title, "Installer les services", "le texte reste");
  const view = (await get(h, `/api/sessions/${s._id}/courses`)).body;
  assert.equal(view[0].rubrics.filter((x) => x.imported).length, 0, "plus importée dans l'ancien cours");

  // Un seul critère par compétence: un doublon n'est pas lié deux fois.
  const dup = (await post(h, "/api/rubrics", body(c1._id, [
    { id: "a", title: "A", weight: 5, competencyId: "k1" },
    { id: "b", title: "B", weight: 5, competencyId: "k1" },
  ]))).body;
  assert.deepEqual(dup.criteria.map((c) => c.competencyId), ["k1", ""]);
});

test("une session ancienne sans champ `courses` n'empêche ni de changer une grille de cours ni de la supprimer", async () => {
  const h = await login("old@example.com");
  const s = (await post(h, "/api/sessions", { name: "Ancienne", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  await mongoose.connection.collection("sessions").updateOne({ _id: new mongoose.Types.ObjectId(s._id) }, { $unset: { courses: "" } });
  const c1 = (await post(h, "/api/courses", { title: "A" })).body;
  const c2 = (await post(h, "/api/courses", { title: "B" })).body;
  const body = (course) => ({ title: "A", taskTitle: "Ex", version: 1, course, isActive: true, criteria: [{ id: "c1", title: "C", weight: 5 }] });
  const r = (await post(h, "/api/rubrics", body(c1._id))).body;
  assert.equal((await put(h, `/api/rubrics/${r._id}`, body(c2._id))).status, 200);
  assert.equal((await request(app).delete(`/api/rubrics/${r._id}`).set(h)).status, 204);
});
