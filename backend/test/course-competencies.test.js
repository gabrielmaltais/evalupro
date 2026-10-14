const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCompetencies } = require("../src/utils/courseCompetencies");

test("retire les lignes vides, nettoie les textes et garde les ids existants", () => {
  const out = normalizeCompetencies([
    { id: "a", title: "  Analyser le projet  ", description: " détail " },
    { id: "b", title: "   " },
    { title: "Planifier l'implantation" },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: "a", title: "Analyser le projet", description: "détail" });
  assert.match(out[1].id, /^comp-[0-9a-f]{8}$/);
  assert.equal(out[1].description, "");
});

test("remplace les ids en double et ignore une entrée qui n'est pas une liste", () => {
  const out = normalizeCompetencies([{ id: "x", title: "A" }, { id: "x", title: "B" }]);
  assert.notEqual(out[0].id, out[1].id);
  assert.deepEqual(normalizeCompetencies(undefined), []);
  assert.deepEqual(normalizeCompetencies("abc"), []);
});
