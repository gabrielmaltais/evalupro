const test = require("node:test");
const assert = require("node:assert/strict");
const { computeEvaluationTotals, criterionKey } = require("../src/utils/evaluationTotals");

const rubric = {
  criteria: [
    { id: "c1", weight: 10 },
    { id: "c2", weight: 5.5 },
    { _id: "legacy", weight: 4 },
  ],
};

test("additionne seulement les critères de la grille et borne chaque note à sa pondération", () => {
  const totals = computeEvaluationTotals(rubric, { c1: 12, c2: 2.25, legacy: -3, supprime: 99 });
  assert.deepEqual(totals, { totalScore: 12.25, totalMax: 19.5 });
});

test("accepte une Map, ignore les valeurs invalides", () => {
  const totals = computeEvaluationTotals(rubric, new Map([["c1", "7.5"], ["c2", null], ["legacy", "abc"]]));
  assert.deepEqual(totals, { totalScore: 7.5, totalMax: 19.5 });
});

test("sans notes ni grille, retourne zéro", () => {
  assert.deepEqual(computeEvaluationTotals(rubric, undefined), { totalScore: 0, totalMax: 19.5 });
  assert.deepEqual(computeEvaluationTotals(undefined, { c1: 3 }), { totalScore: 0, totalMax: 0 });
});

test("la clé d'un critère suit id, puis _id, puis la position", () => {
  assert.equal(criterionKey({ id: "a", _id: "b" }, 0), "a");
  assert.equal(criterionKey({ _id: "b" }, 0), "b");
  assert.equal(criterionKey({}, 3), "3");
});
