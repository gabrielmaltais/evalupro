/** Identifiants étudiant / rubrique sur une évaluation (suivi & envois). */
export function evalStudentId(it) {
  if (!it?.studentId) return null;
  if (typeof it.studentId === "object") return String(it.studentId._id ?? "");
  return String(it.studentId);
}

export function evalRubricId(it) {
  if (!it?.rubric) return null;
  if (typeof it.rubric === "object") return String(it.rubric._id ?? "");
  return String(it.rubric);
}

/** Si plusieurs copies pour le même étudiant et la même grille, on retient la plus récente par date. */
export function findLatestEvalForStudentRubric(studentId, rubricId, itemsList) {
  const sid = String(studentId);
  const rid = String(rubricId);
  const matches = itemsList.filter((it) => {
    const eSid = evalStudentId(it);
    const eRid = evalRubricId(it);
    return eSid === sid && eRid === rid;
  });
  if (!matches.length) return null;
  matches.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""), "fr"));
  return matches[0];
}
