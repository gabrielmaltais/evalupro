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
  assert.equal(reg.statusCode, 201);
  return { Authorization: `Bearer ${reg.body.token}` };
}

const rubricBody = (title, course) => ({
  title,
  taskTitle: "Examen",
  version: 1,
  course,
  criteria: [{ id: "c1", title: "Critère", weight: 10 }],
});

const post = (h, url, body) => request(app).post(url).set(h).send(body);
const get = (h, url) => request(app).get(url).set(h);

async function newSession(h, name = "A26", extra = {}) {
  const s = await post(h, "/api/sessions", { name, startDate: "2026-08-24", endDate: "2099-12-20", ...extra });
  assert.equal(s.statusCode, 201);
  return s.body;
}

test("archive puis restaure une session: groupes et inscriptions seulement, les ressources restent", async () => {
  const h = await login("a@example.com");
  const s = await newSession(h);
  const c = await post(h, "/api/courses", { title: "Réseaux" });
  const r = await post(h, "/api/rubrics", rubricBody("Examen 1", c.body._id));
  assert.equal(r.statusCode, 201);
  const g = await post(h, "/api/groups", { name: "G1" });
  assert.equal(g.statusCode, 201);
  await post(h, `/api/groups/${g.body._id}/students`, { firstName: "Ana", lastName: "Roy" });

  const arch = await post(h, `/api/sessions/${s._id}/archive`, {});
  assert.equal(arch.statusCode, 200);
  assert.deepEqual(arch.body.archived, { groups: 1, students: 1 });
  // Cours, grilles et fiches d'élèves restent actifs.
  assert.equal((await get(h, "/api/courses")).body.length, 1);
  assert.equal((await get(h, "/api/rubrics")).body.length, 1);
  assert.equal((await get(h, "/api/students?scope=library")).body.length, 1);
  assert.equal((await get(h, "/api/groups?session=all")).body.length, 0);
  assert.equal((await get(h, "/api/groups?session=all&archived=1")).body.length, 1);

  const rest = await post(h, `/api/sessions/${s._id}/restore`, {});
  assert.equal(rest.statusCode, 200);
  assert.deepEqual(rest.body.restored, { groups: 1, students: 1 });
  assert.equal((await get(h, "/api/groups?session=all")).body.length, 1);
});

test("un groupe archivé à la main n'est pas restauré avec la session", async () => {
  const h = await login("a2@example.com");
  const s = await newSession(h);
  const g1 = await post(h, "/api/groups", { name: "G1" });
  await post(h, "/api/groups", { name: "G2" });
  await post(h, `/api/groups/${g1.body._id}/archive`, {});
  await post(h, `/api/sessions/${s._id}/archive`, {});
  await post(h, `/api/sessions/${s._id}/restore`, {});
  const names = (await get(h, `/api/groups?session=${s._id}`)).body.map((x) => x.name);
  assert.deepEqual(names, ["G2"]);
});

test("archivage automatique d'une session échue", async () => {
  const h = await login("b@example.com");
  await post(h, "/api/sessions", { name: "Vieille", startDate: "2020-01-10", endDate: "2020-05-10" });
  const list = await get(h, "/api/sessions");
  assert.equal(list.body[0].status, "archived");
  assert.equal(list.body[0].archivedBy, "auto");
});

test("les données sont propres à chaque utilisateur", async () => {
  const a = await login("c@example.com");
  const b = await login("d@example.com");
  const c = await post(a, "/api/courses", { title: "Privé" });
  const r = await post(a, "/api/rubrics", rubricBody("Privée", c.body._id));
  assert.equal((await get(b, "/api/rubrics")).body.length, 0);
  assert.equal((await request(app).put(`/api/rubrics/${r.body._id}`).set(b).send({ title: "x" })).statusCode, 404);
  assert.equal((await post(b, `/api/rubrics/${r.body._id}/archive`, {})).statusCode, 404);
  // Une grille ne peut pas être classée dans le cours d'un autre utilisateur.
  assert.equal((await post(b, "/api/rubrics", rubricBody("Intrus", c.body._id))).statusCode, 400);
});

test("une grille doit être classée dans un cours", async () => {
  const h = await login("e0@example.com");
  const res = await post(h, "/api/rubrics", { title: "Orpheline", taskTitle: "X", version: 1, criteria: [] });
  assert.equal(res.statusCode, 400);
});

test("un groupe suit des cours de la session; les évaluations cochées de ces cours sont corrigeables", async () => {
  const h = await login("e1@example.com");
  const sess = await newSession(h);
  const sid = sess._id;
  const c1 = await post(h, "/api/courses", { title: "Réseaux" });
  const c2 = await post(h, "/api/courses", { title: "Sécurité" });
  const r1 = await post(h, "/api/rubrics", rubricBody("Examen 1", c1.body._id));
  const r2 = await post(h, "/api/rubrics", rubricBody("Examen 2", c1.body._id));
  const r3 = await post(h, "/api/rubrics", rubricBody("TP sécurité", c2.body._id));
  const g = await post(h, "/api/groups", { name: "G1" });
  const e1 = (await post(h, `/api/sessions/${sid}/courses`, { courseId: c1.body._id, rubricIds: [r1.body._id], groupIds: [g.body._id] })).body[0];
  await post(h, `/api/sessions/${sid}/courses`, { courseId: c2.body._id, rubricIds: [r3.body._id], groupIds: [g.body._id] });

  const detail = (await get(h, `/api/groups/${g.body._id}`)).body;
  assert.deepEqual(detail.courseList.map((c) => c.title).sort(), ["Réseaux", "Sécurité"]);
  assert.deepEqual(detail.rubrics.map((x) => x.title).sort(), ["Examen 1", "TP sécurité"]);

  const rubrics = (await get(h, "/api/rubrics")).body;
  assert.deepEqual(rubrics.find((x) => x.title === "TP sécurité").groups, ["G1"]);
  assert.deepEqual(rubrics.find((x) => x.title === "Examen 2").groups, []);

  // Cocher une évaluation de plus; ne plus donner un cours au groupe retire ses évaluations sans rien supprimer.
  await request(app).put(`/api/sessions/${sid}/courses/${e1._id}`).set(h).send({ rubricIds: [r1.body._id, r2.body._id] });
  assert.deepEqual((await get(h, `/api/groups/${g.body._id}/rubrics`)).body.map((x) => x.title).sort(), ["Examen 1", "Examen 2", "TP sécurité"]);
  await request(app).put(`/api/sessions/${sid}/courses/${e1._id}`).set(h).send({ groupIds: [] });
  assert.deepEqual((await get(h, `/api/groups/${g.body._id}/rubrics`)).body.map((x) => x.title), ["TP sécurité"]);
  assert.equal((await get(h, "/api/rubrics")).body.length, 3);
});

test("dupliquer une grille: la copie est indépendante, importable dans un autre cours ou à la place de l'originale", async () => {
  const h = await login("e1b@example.com");
  const sess = await newSession(h);
  const sid = sess._id;
  const c1 = await post(h, "/api/courses", { title: "Réseaux" });
  const c2 = await post(h, "/api/courses", { title: "Sécurité" });
  const r = await post(h, "/api/rubrics", rubricBody("Examen", c1.body._id));
  const g = await post(h, "/api/groups", { name: "G1" });
  await post(h, `/api/sessions/${sid}/courses`, { courseId: c1.body._id, rubricIds: [r.body._id], groupIds: [g.body._id] });

  const dup = await post(h, `/api/rubrics/${r.body._id}/copy`, { replaceInGroups: true });
  assert.equal(dup.statusCode, 201);
  assert.equal(dup.body.title, "Examen (copie)");
  assert.equal(dup.body.course, c1.body._id);
  assert.deepEqual((await get(h, `/api/groups/${g.body._id}/rubrics`)).body.map((x) => x._id), [dup.body._id]);
  // Modifier la copie ne touche pas l'original.
  await request(app).put(`/api/rubrics/${dup.body._id}`).set(h).send({ title: "Examen v2" });
  const all = (await get(h, "/api/rubrics")).body;
  assert.equal(all.find((x) => x._id === r.body._id).title, "Examen");

  // Importer une grille dans un autre cours = la copier vers ce cours.
  const moved = await post(h, `/api/rubrics/${r.body._id}/copy`, { courseId: c2.body._id });
  assert.equal(moved.body.course, c2.body._id);
  assert.equal(moved.body.title, "Examen");
});

test("modifier une compétence met à jour les grilles pas encore utilisées seulement", async () => {
  const h = await login("e2@example.com");
  await newSession(h);
  const c = await post(h, "/api/courses", { title: "Réseaux", competencies: [{ id: "k1", title: "Analyser" }, { id: "k2", title: "Déployer" }] });
  const crit = (id, title) => ({ id, title, weight: 5, competencyElement: title });
  const fresh = await post(h, "/api/rubrics", { ...rubricBody("Neuve", c.body._id), criteria: [crit("a", "Analyser"), crit("b", "Déployer")] });
  const used = await post(h, "/api/rubrics", { ...rubricBody("Utilisée", c.body._id), criteria: [crit("a", "Analyser")] });
  const g = await post(h, "/api/groups", { name: "G1", courses: [c.body._id] });
  const st = await post(h, `/api/groups/${g.body._id}/students`, { firstName: "Ana", lastName: "Roy" });
  const ev = await post(h, "/api/evaluations", { studentName: "x", studentId: st.body.student._id, date: "2026-10-01", rubric: used.body._id, scores: {} });
  assert.equal(ev.statusCode, 201);

  const upd = await request(app).put(`/api/courses/${c.body._id}`).set(h).send({
    competencies: [{ id: "k1", title: "Analyser les besoins" }],
  });
  assert.equal(upd.statusCode, 200);
  assert.deepEqual(upd.body.sync, { updated: 1, skipped: 1 });
  const rubrics = (await get(h, "/api/rubrics")).body;
  const neuve = rubrics.find((x) => x._id === fresh.body._id);
  assert.equal(neuve.criteria[0].title, "Analyser les besoins");
  assert.equal(neuve.criteria[0].competencyElement, "Analyser les besoins");
  assert.equal(neuve.criteria[0].competencyId, "k1");
  assert.equal(neuve.criteria[1].competencyId, ""); // compétence retirée: le lien est coupé, le texte reste
  assert.equal(neuve.criteria[1].title, "Déployer");
  const utilisee = rubrics.find((x) => x._id === used.body._id);
  assert.equal(utilisee.criteria[0].title, "Analyser");
});

test("la correction hérite du groupe et de la session; l'élève garde sa fiche d'une session à l'autre", async () => {
  const h = await login("e3@example.com");
  const s1 = await newSession(h, "A26");
  const c = await post(h, "/api/courses", { title: "Réseaux" });
  const r = await post(h, "/api/rubrics", rubricBody("Examen", c.body._id));
  const g = await post(h, "/api/groups", { name: "G1" });
  await post(h, `/api/sessions/${s1._id}/courses`, { courseId: c.body._id, groupIds: [g.body._id] });
  const st = (await post(h, `/api/groups/${g.body._id}/students`, { firstName: "Ana", lastName: "Roy" })).body.student;
  const ev = await post(h, "/api/evaluations", { studentName: "x", studentId: st._id, date: "2026-10-01", rubric: r.body._id, scores: {} });
  assert.equal(ev.body.group, g.body._id);
  assert.equal(ev.body.session, s1._id);
  assert.equal((await get(h, "/api/students")).body[0].group, "G1");

  // Nouvelle session: mêmes cours, mêmes élèves.
  const copy = await post(h, `/api/sessions/${s1._id}/copy`, {
    name: "H27", startDate: "2027-01-10", endDate: "2099-12-20", carryStudents: true, archiveSource: true,
  });
  assert.equal(copy.statusCode, 201);
  assert.deepEqual(copy.body.copied, { groups: 1, students: 1 });
  assert.equal((await get(h, "/api/courses")).body.length, 1); // aucune duplication
  assert.equal((await get(h, "/api/rubrics")).body.length, 1);
  assert.equal((await get(h, "/api/students?scope=library")).body.length, 1); // une seule fiche

  await request(app).put("/api/sessions/active").set(h).send({ sessionId: copy.body.session._id });
  // Le groupe reprend ses cours mais pas ses grilles: on réimporte les versions à jour.
  const newGroup = (await get(h, "/api/groups")).body[0];
  assert.equal(newGroup.courses.length, 1);
  assert.equal(newGroup.availableRubricCount, 0);
  const dash = (await get(h, "/api/students/group-dashboard")).body;
  assert.equal(dash[0].group, "G1");
  assert.equal(dash[0].students, 1);
  assert.equal(dash[0].evaluations, 0); // les notes de la session précédente n'y sont pas
  assert.equal((await get(h, "/api/evaluations")).body.total, 0);
  // L'historique de l'élève traverse les sessions.
  assert.equal((await get(h, `/api/evaluations?studentId=${st._id}`)).body.total, 1);
  assert.equal((await get(h, "/api/evaluations?session=all")).body.total, 1);
});

test("session active: choix explicite, sinon la session en cours", async () => {
  const h = await login("e4@example.com");
  assert.equal((await get(h, "/api/sessions/active")).body.session, null);
  const a = await newSession(h, "Courante");
  const b = await newSession(h, "Autre", { startDate: "2026-01-01" });
  const first = (await get(h, "/api/sessions/active")).body.session;
  assert.ok([a._id, b._id].includes(first._id));
  const put = await request(app).put("/api/sessions/active").set(h).send({ sessionId: b._id });
  assert.equal(put.body.session._id, b._id);
  assert.equal((await get(h, "/api/sessions/active")).body.session._id, b._id);
  // Archiver la session active retombe sur l'autre.
  await post(h, `/api/sessions/${b._id}/archive`, {});
  assert.equal((await get(h, "/api/sessions/active")).body.session._id, a._id);
});

test("supprimer une session avec des évaluations demande confirmation et garde les fiches", async () => {
  const h = await login("e5@example.com");
  const s = await newSession(h);
  const c = await post(h, "/api/courses", { title: "Réseaux" });
  const r = await post(h, "/api/rubrics", rubricBody("Examen", c.body._id));
  const g = await post(h, "/api/groups", { name: "G1", courses: [c.body._id] });
  const st = (await post(h, `/api/groups/${g.body._id}/students`, { firstName: "Ana", lastName: "Roy" })).body.student;
  await post(h, "/api/evaluations", { studentName: "x", studentId: st._id, date: "2026-10-01", rubric: r.body._id, scores: {} });

  const refused = await request(app).delete(`/api/sessions/${s._id}`).set(h);
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.body.evaluations, 1);
  const done = await request(app).delete(`/api/sessions/${s._id}?force=1`).set(h);
  assert.equal(done.statusCode, 204);
  assert.equal((await get(h, "/api/students?scope=library")).body.length, 1);
  assert.equal((await get(h, "/api/evaluations?session=all")).body.total, 1);
  assert.equal((await get(h, "/api/courses")).body.length, 1);
});

test("un cours qui contient des grilles ne se supprime pas; l'archiver range ses grilles", async () => {
  const h = await login("e6@example.com");
  const c = await post(h, "/api/courses", { title: "Réseaux" });
  await post(h, "/api/rubrics", rubricBody("Examen", c.body._id));
  assert.equal((await request(app).delete(`/api/courses/${c.body._id}`).set(h)).statusCode, 409);
  const arch = await post(h, `/api/courses/${c.body._id}/archive`, {});
  assert.equal(arch.body.archivedRubrics, 1);
  assert.equal((await get(h, "/api/rubrics")).body.length, 0);
  const rest = await post(h, `/api/courses/${c.body._id}/restore`, {});
  assert.equal(rest.body.restoredRubrics, 1);
  assert.equal((await get(h, "/api/rubrics")).body.length, 1);
});

test("groupe archivé: exclu du tableau et restaurable", async () => {
  const h = await login("f@example.com");
  await newSession(h);
  await post(h, "/api/students", { name: "Al Bo", group: "G1" });
  await post(h, "/api/students/groups/archive", { group: "G1" });
  assert.equal((await get(h, "/api/students/group-dashboard")).body.length, 0);
  assert.equal((await get(h, "/api/students/groups/archived")).body[0].group, "G1");
  await post(h, "/api/students/groups/restore", { group: "G1" });
  assert.equal((await get(h, "/api/students")).body.length, 1);
});

test("un élève n'a qu'un groupe par session; changer de groupe déplace l'inscription", async () => {
  const h = await login("g@example.com");
  await newSession(h);
  const st = await post(h, "/api/students", { name: "Al Bo", group: "G1" });
  assert.equal(st.body.group, "G1");
  const moved = await request(app).put(`/api/students/${st.body._id}`).set(h).send({ group: "G2" });
  assert.equal(moved.body.group, "G2");
  const dash = (await get(h, "/api/students/group-dashboard")).body;
  assert.deepEqual(dash.map((d) => [d.group, d.students]), [["G1", 0], ["G2", 1]]);
  const cleared = await request(app).put(`/api/students/${st.body._id}`).set(h).send({ group: "" });
  assert.equal(cleared.body.group, "");
});

test("créer un élève avec un groupe sans aucune session est refusé avec un message clair", async () => {
  const h = await login("h@example.com");
  const res = await post(h, "/api/students", { name: "Al Bo", group: "G1" });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /session/i);
  assert.equal((await post(h, "/api/students", { name: "Sans Groupe" })).statusCode, 201);
});

test("renommer, fusionner et dissoudre des groupes par nom", async () => {
  const h = await login("i@example.com");
  await newSession(h);
  await post(h, "/api/students/bulk", { students: [{ name: "A A", group: "G1" }, { name: "B B", group: "G2" }, { name: "C C", group: "G2" }] });
  assert.equal((await post(h, "/api/students/groups/rename", { from: "G1", to: "X" })).statusCode, 200);
  assert.equal((await post(h, "/api/students/groups/rename", { from: "X", to: "G2" })).statusCode, 409);
  const merged = await post(h, "/api/students/groups/merge", { fromGroups: ["X"], to: "G2" });
  assert.equal(merged.body.modified, 1);
  assert.deepEqual((await get(h, "/api/students/group-dashboard")).body.map((d) => [d.group, d.students]), [["G2", 3]]);
  await request(app).delete("/api/students/groups/G2").set(h);
  assert.equal((await get(h, "/api/students")).body.every((s) => s.group === ""), true);
});

test("couleur et icône d'un groupe passent par les styles de groupe", async () => {
  const h = await login("j@example.com");
  await newSession(h);
  await post(h, "/api/groups", { name: "G1" });
  const put = await request(app).put("/api/group-styles/G1").set(h).send({ color: "#112233", icon: "fa-users" });
  assert.equal(put.body.color, "#112233");
  const list = (await get(h, "/api/group-styles")).body;
  assert.deepEqual(list.map((x) => [x.groupKey, x.color]), [["G1", "#112233"]]);
  assert.equal((await request(app).put("/api/group-styles/Inconnu").set(h).send({ color: "#112233" })).statusCode, 404);
});

test("exporte les notes d'une session en CSV", async () => {
  const h = await login("k@example.com");
  const s = await newSession(h);
  const c = await post(h, "/api/courses", { title: "Réseaux" });
  const r = await post(h, "/api/rubrics", rubricBody("Examen", c.body._id));
  const g = await post(h, "/api/groups", { name: "G1", courses: [c.body._id] });
  const st = (await post(h, `/api/groups/${g.body._id}/students`, { firstName: "Ana", lastName: "Roy", email: "ana@example.com" })).body.student;
  await post(h, "/api/evaluations", { studentName: "x", studentId: st._id, date: "2026-10-01", rubric: r.body._id, scores: {} });
  const csv = await get(h, `/api/sessions/${s._id}/export`);
  assert.equal(csv.statusCode, 200);
  assert.match(csv.text, /G1/);
  assert.match(csv.text, /Ana Roy/);
});
