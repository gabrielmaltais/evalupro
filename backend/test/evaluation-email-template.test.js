const test = require("node:test");
const assert = require("node:assert/strict");
const { applyTemplate, buildEvaluationEmailParts } = require("../src/services/evaluationEmailTemplate");

test("applyTemplate remplace les variables", () => {
  assert.equal(
    applyTemplate("Hi {studentName}, {examTitle}", { studentName: "A", examTitle: "Ex" }),
    "Hi A, Ex"
  );
});

test("buildEvaluationEmailParts utilise les champs rubric et owner", () => {
  const smtp = { emailSubjectTemplate: "S: {examTitle}", emailBodyTemplate: "T: {teacherName} / {courseTitle}" };
  const { subject, text } = buildEvaluationEmailParts(smtp, {
    owner: { name: "Prof. Dupont" },
    student: { name: "Jean", group: "G1" },
    rubric: { title: "Prog", taskTitle: "Lab 1" },
  });
  assert.equal(subject, "S: Lab 1");
  assert.match(text, /Prof\. Dupont/);
  assert.match(text, /Prog/);
});
