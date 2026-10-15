import { describe, expect, it } from "vitest";
import { buildAITemplate } from "./aiTemplate";
import { isTemplatePlaceholder } from "./aiTemplate";
import { normalizeImportedRubric, parseAiJson, unwrapAiTemplateEnvelope } from "./rubricTemplate";
import { alignCriteriaToCourse } from "./courseHelpers";

const course = {
  title: "Réseaux 1",
  competencies: [
    { id: "comp-a", title: "Installer les services réseau" },
    { id: "comp-b", title: "Sécuriser l'infrastructure" },
  ],
};

/** Ce qu'une IA ferait: remplit le gabarit (points, tâches, descripteurs) sans toucher aux titres. */
function fill(template) {
  const t = JSON.parse(JSON.stringify(template.template_a_remplir));
  t.taskTitle = "Examen 1";
  t.criteria.forEach((c, i) => {
    c.weight = 10;
    c.subCriteria = [
      { id: `${c.id}-sc1`, label: `Question ${i + 1}a`, pts: 6, feedback: "Revois la configuration." },
      { id: `${c.id}-sc2`, label: `Question ${i + 1}b`, pts: 4, feedback: "Ajoute des tests." },
    ];
    c.levels.forEach((l) => (l.desc = `Qualité au niveau ${l.label}`));
  });
  t.feedbackMessages.forEach((m, i) => (m.message = `Message ${i}`));
  t.aValider = [];
  return t;
}

const wrappers = {
  "JSON pur": (o) => JSON.stringify(o),
  "bloc ```json avec texte autour": (o) => `Voici la grille :\n\n\`\`\`json\n${JSON.stringify(o, null, 2)}\n\`\`\`\n\nDis-moi si tu veux des changements.`,
  "texte avant et après sans bloc": (o) => `Bien sûr ! ${JSON.stringify(o)} J'espère que ça aide.`,
  "virgules en trop": (o) => JSON.stringify(o, null, 2).replace(/\n(\s*)\}/g, ",\n$1}"),
  "guillemets typographiques": (o) => JSON.stringify(o).replace(/"([a-zA-Z_]+)":/g, "“$1”:").replace(/:"([^"]*)"/g, ":“$1”"),
  "gabarit complet renvoyé": (o, full) => JSON.stringify({ ...full, template_a_remplir: o }),
};

describe("gabarit IA -> réponse -> import", () => {
  const template = buildAITemplate({ course, langue: "fr", niveaux: "4" });

  it("le gabarit reprend les compétences du cours, avec leurs ids", () => {
    const crit = template.template_a_remplir.criteria;
    expect(crit.map((c) => c.title)).toEqual(course.competencies.map((c) => c.title));
    expect(crit.map((c) => c.competencyId)).toEqual(["comp-a", "comp-b"]);
  });

  for (const [name, wrap] of Object.entries(wrappers)) {
    it(`importe une réponse : ${name}`, () => {
      const filled = fill(template);
      const json = parseAiJson(wrap(filled, template));
      const res = normalizeImportedRubric(unwrapAiTemplateEnvelope(json));
      expect(res.ok).toBe(true);
      expect(res.rubric.criteria).toHaveLength(2);
      expect(res.rubric.criteria[0].weight).toBe(10);
      expect(res.warnings).toEqual([]);
      const al = alignCriteriaToCourse(res.rubric.criteria, course.competencies);
      expect(al.linked).toBe(2);
      expect(al.missing).toEqual([]);
    });
  }

  it("rattache par titre quand l'IA perd ou change les ids (accents, casse, ponctuation)", () => {
    const filled = fill(template);
    filled.criteria.forEach((c) => delete c.competencyId);
    filled.criteria[0].title = "installer les services reseau.";
    filled.criteria[0].competencyElement = "Installer les services réseau";
    filled.criteria[1].competencyElement = "SÉCURISER l’infrastructure";
    const al = alignCriteriaToCourse(normalizeImportedRubric(filled).rubric.criteria, course.competencies);
    expect(al.criteria.map((c) => c.competencyId)).toEqual(["comp-a", "comp-b"]);
  });

  it("ne devine pas: critère inconnu = non lié, compétence oubliée = signalée", () => {
    const filled = fill(template);
    filled.criteria = [filled.criteria[0], { ...filled.criteria[1], title: "Autre chose", competencyElement: "", competencyId: "comp-zzz" }];
    const al = alignCriteriaToCourse(normalizeImportedRubric(filled).rubric.criteria, course.competencies);
    expect(al.linked).toBe(1);
    expect(al.unlinked).toBe(1);
    expect(al.criteria[1].competencyId).toBe("");
    expect(al.missing.map((c) => c.id)).toEqual(["comp-b"]);
  });

  it("changer de cours après la génération: les liens de l'ancien cours sont coupés", () => {
    const other = [{ id: "comp-x", title: "Programmer en Python" }];
    const al = alignCriteriaToCourse(normalizeImportedRubric(fill(template)).rubric.criteria, other);
    expect(al.linked).toBe(0);
    expect(al.criteria.every((c) => c.competencyId === "")).toBe(true);
    expect(al.missing).toHaveLength(1);
  });

  it("repère le texte du gabarit non remplacé (FR et EN)", () => {
    for (const langue of ["fr", "en"]) {
      const raw = buildAITemplate({ course, langue }).template_a_remplir;
      expect(isTemplatePlaceholder(raw.taskTitle)).toBe(true);
      expect(isTemplatePlaceholder(raw.criteria[0].subCriteria[0].label)).toBe(true);
      expect(isTemplatePlaceholder(raw.criteria[0].subCriteria[0].feedback)).toBe(true);
      expect(isTemplatePlaceholder(raw.criteria[0].levels[0].desc)).toBe(true);
      expect(isTemplatePlaceholder(raw.feedbackMessages[0].message)).toBe(true);
    }
    expect(isTemplatePlaceholder("Examen 1")).toBe(false);
    expect(isTemplatePlaceholder("")).toBe(false);
  });

  it("signale une réponse coupée", () => {
    const cut = JSON.stringify(fill(template)).slice(0, 400);
    expect(() => parseAiJson(cut)).toThrow(/incomplète/);
    expect(() => parseAiJson("pas du json")).toThrow(/invalide/);
  });

  it("accepte un tableau de critères seul", () => {
    const res = normalizeImportedRubric(unwrapAiTemplateEnvelope(parseAiJson(JSON.stringify(fill(template).criteria))));
    expect(res.ok).toBe(true);
    expect(res.rubric.criteria).toHaveLength(2);
  });

  it("le gabarit sans cours reste utilisable (critères à fournir par l'enseignant)", () => {
    const t = buildAITemplate({ langue: "fr" });
    expect(t.template_a_remplir.criteria).toHaveLength(1);
    expect(t._prompt_configuration.criteres_de_performance_du_cours).toBeUndefined();
  });
});
