/**
 * Transforme un texte collé (une compétence ou un critère par ligne) en liste de compétences.
 * Retire les puces et la numérotation (« 1. », « 2) », « - », « • », « a) ») et les lignes vides.
 */
export function parseCompetencyLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–—]|\(?\d{1,3}[.)\]:-]?|[a-zA-Z][.)])\s+/, "").trim())
    .filter(Boolean)
    .map((title) => ({ title, description: "" }));
}

/** Une compétence prête à être envoyée à l'IA : titre obligatoire, description facultative. */
export function competenciesForAi(course) {
  return (course?.competencies || [])
    .map((c) => ({ title: String(c?.title || "").trim(), description: String(c?.description || "").trim() }))
    .filter((c) => c.title);
}
