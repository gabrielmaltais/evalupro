const DEFAULT_SUBJECT = "Copie d'évaluation — {examTitle}";

const DEFAULT_BODY = `Bonjour {studentName},

Veuillez trouver ci-joint votre copie d'évaluation pour « {examTitle} » ({courseTitle}).

Cordialement,
{teacherName}`;

/**
 * Remplace {cle} dans le modèle. Clés supportées : studentName, examTitle, courseTitle, teacherName, group.
 */
function applyTemplate(template, vars) {
  if (!template) return "";
  let out = String(template);
  Object.entries(vars).forEach(([k, v]) => {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, String(v ?? ""));
  });
  return out;
}

function buildEvaluationEmailParts(smtpConfig, { owner, student, rubric }) {
  const examTitle = rubric.taskTitle || rubric.title || "Évaluation";
  const courseTitle = rubric.title || "";
  const vars = {
    studentName: student.name || "",
    examTitle,
    courseTitle,
    teacherName: owner.name || "Enseignant",
    group: student.group || "",
  };
  const subjectTpl = (smtpConfig.emailSubjectTemplate && smtpConfig.emailSubjectTemplate.trim()) || DEFAULT_SUBJECT;
  const bodyTpl = (smtpConfig.emailBodyTemplate && smtpConfig.emailBodyTemplate.trim()) || DEFAULT_BODY;
  return {
    subject: applyTemplate(subjectTpl, vars),
    text: applyTemplate(bodyTpl, vars),
  };
}

module.exports = {
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  applyTemplate,
  buildEvaluationEmailParts,
};
