const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");

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

test("un groupe commun se retrouve d'une session à l'autre, avec des cours propres à chaque session", async () => {
  const h = await login("g1@example.com");
  const a = (await post(h, "/api/sessions", { name: "A26", startDate: "2026-08-24", endDate: "2099-12-20" })).body;
  const c1 = (await post(h, "/api/courses", { title: "Réseaux" })).body;
  const c2 = (await post(h, "/api/courses", { title: "Sécurité" })).body;

  // Créé dans la session: apparaît dans Ressources, utilisé en A26.
  await post(h, "/api/groups", { name: "TI-1", session: a._id, courses: [c1._id], color: "#ff0000" });
  let list = (await get(h, "/api/common-groups")).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].color, "#ff0000");
  assert.deepEqual(list[0].sessions.map((s) => s.name), ["A26"]);

  // Nouvelle session: le groupe commun y est ajouté avec d'autres cours; A26 garde les siens.
  const b = (await post(h, "/api/sessions", { name: "H27", startDate: "2027-01-10", endDate: "2099-12-30" })).body;
  const gb = (await post(h, "/api/groups", { name: "TI-1", session: b._id, courses: [c2._id] })).body;
  assert.equal(gb.color, "#ff0000");
  const groupsA = (await get(h, `/api/groups?session=${a._id}`)).body;
  assert.deepEqual(groupsA[0].courseList.map((c) => c.title), ["Réseaux"]);
  assert.deepEqual(gb.courseList.map((c) => c.title), ["Sécurité"]);
  list = (await get(h, "/api/common-groups")).body;
  assert.deepEqual(list[0].sessions.map((s) => s.name).sort(), ["A26", "H27"]);
  list = (await get(h, "/api/common-groups")).body;

  // Les élèves du groupe le suivent dans la nouvelle session.
  const ga = (await get(h, `/api/groups?session=${a._id}`)).body[0];
  await post(h, `/api/groups/${ga._id}/students`, { firstName: "Ana", lastName: "Roy" });
  const gc = (await post(h, "/api/groups", { name: "TI-1", session: (await post(h, "/api/sessions", { name: "E27", startDate: "2027-05-10", endDate: "2099-12-31" })).body._id })).body;
  assert.equal(gc.studentCount, 1);

  // Retirer le groupe de la session (archive) puis le remettre: il revient avec ses élèves.
  await post(h, `/api/groups/${gc._id}/archive`, {});
  assert.equal((await post(h, "/api/groups", { name: "TI-1", session: gc.session })).body.studentCount, 1);
  assert.equal((await post(h, "/api/groups", { name: "TI-1", session: gc.session })).status, 409);

  // Renommer le groupe commun renomme le groupe dans chaque session.
  await put(h, `/api/common-groups/${list[0]._id}`, { name: "TI-A", color: "#00ff00" });
  const groupsB = (await get(h, `/api/groups?session=${b._id}`)).body;
  assert.equal(groupsB[0].name, "TI-A");
  assert.equal(groupsB[0].color, "#00ff00");
  assert.equal((await get(h, `/api/groups?session=${a._id}`)).body[0].name, "TI-A");

  // Utilisé: pas de suppression. Un groupe jamais utilisé se supprime.
  assert.equal((await request(app).delete(`/api/common-groups/${list[0]._id}`).set(h)).status, 409);
  const free = (await post(h, "/api/common-groups", { name: "TI-2" })).body;
  assert.equal((await post(h, "/api/common-groups", { name: "TI-2" })).status, 409);
  assert.equal((await request(app).delete(`/api/common-groups/${free._id}`).set(h)).status, 204);
});

test("les groupes communs sont propres à chaque utilisateur", async () => {
  const h1 = await login("g2@example.com");
  const h2 = await login("g3@example.com");
  const g = (await post(h1, "/api/common-groups", { name: "TI-1" })).body;
  assert.deepEqual((await get(h2, "/api/common-groups")).body, []);
  assert.equal((await put(h2, `/api/common-groups/${g._id}`, { name: "X" })).status, 404);
  assert.equal((await post(h2, "/api/common-groups", { name: "TI-1" })).status, 201);
});
