const test = require("node:test");
const assert = require("node:assert/strict");
const { planGroupMigration, NO_SESSION } = require("../src/services/groupMigration");

const d1 = new Date("2026-05-01T00:00:00Z");
const d2 = new Date("2026-06-01T00:00:00Z");

test("un groupe par (session, nom) et une inscription par élève avec groupe", () => {
  const plan = planGroupMigration({
    students: [
      { _id: "s1", group: "A1", session: "ses1" },
      { _id: "s2", group: "A1", session: "ses1" },
      { _id: "s3", group: "A1", session: "ses2" },
      { _id: "s4", group: "", session: "ses1" },
      { _id: "s5", group: "B2" },
    ],
  });
  assert.equal(plan.groups.length, 3);
  assert.equal(plan.enrollments.length, 4);
  assert.ok(plan.groups.find((g) => g.name === "B2" && g.sessionKey === NO_SESSION));
});

test("un groupe est archivé seulement si tous ses élèves le sont", () => {
  const plan = planGroupMigration({
    students: [
      { _id: "s1", group: "A", session: "x", archivedAt: d1 },
      { _id: "s2", group: "A", session: "x", archivedAt: d2 },
      { _id: "s3", group: "B", session: "x", archivedAt: d1 },
      { _id: "s4", group: "B", session: "x" },
    ],
  });
  assert.deepEqual(plan.groups.find((g) => g.name === "A").archivedAt, d2);
  assert.equal(plan.groups.find((g) => g.name === "B").archivedAt, null);
});

test("les groupes visés d'une grille deviennent cours du groupe ou grille directe", () => {
  const plan = planGroupMigration({
    students: [{ _id: "s1", group: "A", session: "x" }, { _id: "s2", group: "C", session: "x" }],
    rubrics: [
      { _id: "r1", course: "c1", groups: ["A"] },
      { _id: "r2", course: null, groups: ["A", "Inconnu"] },
      { _id: "r3", course: "c2", groups: [] },
    ],
  });
  const a = plan.groups.find((g) => g.name === "A");
  assert.deepEqual(a.courses, ["c1"]);
  assert.deepEqual(a.extraRubrics, ["r2"]);
  const c = plan.groups.find((g) => g.name === "C");
  assert.deepEqual(c.courses, []);
  assert.deepEqual(c.extraRubrics, []);
});

test("le style de groupe est repris", () => {
  const plan = planGroupMigration({
    students: [{ _id: "s1", group: "A", session: "x" }],
    styles: [{ groupKey: "A", color: "#ff0000", icon: "fa-users" }],
  });
  assert.equal(plan.groups[0].color, "#ff0000");
  assert.equal(plan.groups[0].icon, "fa-users");
});
