const test = require("node:test");
const assert = require("node:assert/strict");
const { toCsv, escapeCell } = require("../src/utils/csv");

test("met entre guillemets les cellules avec séparateur, guillemets ou saut de ligne", () => {
  assert.equal(escapeCell('A;B'), '"A;B"');
  assert.equal(escapeCell('dit "oui"'), '"dit ""oui"""');
  assert.equal(escapeCell("l1\nl2"), '"l1\nl2"');
});

test("neutralise les formules mais garde les nombres négatifs", () => {
  assert.equal(escapeCell("=SOMME(A1)"), "'=SOMME(A1)");
  assert.equal(escapeCell("@cmd"), "'@cmd");
  assert.equal(escapeCell(-3.5), "-3.5");
  assert.equal(escapeCell(null), "");
});

test("ajoute le BOM et sépare les lignes par CRLF", () => {
  assert.equal(toCsv([["a", "b"], [1, 2]]), "﻿a;b\r\n1;2\r\n");
});
