const test = require("node:test");
const assert = require("node:assert");
const { DEFAULTS, sanitizePdfSettings, fill } = require("../src/utils/pdfSettings");
const { createThemedPdfBuffer } = require("../src/services/evaluationPdfThemes");
const { sampleEvaluation } = require("../src/services/pdfSampleData");

test("sanitizePdfSettings ignore les clés inconnues et les mauvais types", () => {
  const s = sanitizePdfSettings({ layout: "x", showDate: "oui", signatureText: "  Prof   X ", evil: 1, palette: "ardoise" });
  assert.strictEqual(s.layout, DEFAULTS.layout);
  assert.strictEqual(s.showDate, true);
  assert.strictEqual(s.signatureText, "Prof X");
  assert.strictEqual(s.palette, "ardoise");
  assert.ok(!("evil" in s));
});

test("fill remplace les variables connues seulement", () => {
  assert.strictEqual(fill("{prenom} / {x}", { prenom: "Ana" }), "Ana / {x}");
});

test("le PDF se génère avec chaque mise en page et sans signature par défaut", async () => {
  const { evaluation, rubric } = sampleEvaluation();
  for (const layout of ["compact", "detaille"]) {
    const buf = await createThemedPdfBuffer(evaluation, rubric, { teacherName: "Gabriel Maltais", settings: sanitizePdfSettings({ layout }) });
    assert.ok(buf.length > 1000);
    assert.ok(!buf.toString("latin1").includes("Maltais"));
  }
});
