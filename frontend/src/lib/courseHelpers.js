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

/** Clé de comparaison de titres: sans accents, casse, ponctuation ni espaces multiples (les IA reformulent un peu). */
export function titleKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Rattache les critères aux compétences du cours: par `competencyId` s'il existe dans le cours, sinon par titre
 * (élément de compétence ou titre du critère). Un lien qui ne correspond à rien dans ce cours est coupé; le texte
 * reste. Ne devine jamais (pas de rattachement par position).
 * Retourne { criteria, linked, unlinked, missing } (missing = compétences du cours sans critère).
 */
export function alignCriteriaToCourse(criteria, competencies) {
  const comps = (competencies || []).filter((c) => c && c.id && c.title);
  const byId = new Map(comps.map((c) => [c.id, c]));
  const byTitle = new Map(comps.map((c) => [titleKey(c.title), c]));
  const used = new Set();
  const out = (criteria || []).map((cr) => {
    const hit =
      (cr.competencyId && byId.get(cr.competencyId)) ||
      byTitle.get(titleKey(cr.competencyElement)) ||
      byTitle.get(titleKey(cr.title)) ||
      null;
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      return { ...cr, competencyId: hit.id, competencyElement: hit.title };
    }
    return { ...cr, competencyId: "" };
  });
  const linked = out.filter((c) => c.competencyId).length;
  return { criteria: out, linked, unlinked: out.length - linked, missing: comps.filter((c) => !used.has(c.id)) };
}
