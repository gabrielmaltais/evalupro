import { describe, expect, it } from "vitest";
import { buildAITemplate, LEVEL_SCALES } from "./aiTemplate";
import { checkRubricSums, matchLevel, normalizeImportedRubric, taskPoints } from "./rubricTemplate";

describe("gabarit IA", () => {
  it("produit un gabarit importable avec l'échelle choisie", () => {
    const template = buildAITemplate({ niveaux: "4" });
    const result = normalizeImportedRubric(template.template_a_remplir);
    expect(result.ok).toBe(true);
    const levels = result.rubric.criteria[0].levels;
    expect(levels.map((l) => l.label)).toEqual(LEVEL_SCALES[4].map((l) => l.label));
    expect(levels.map((l) => l.minPct)).toEqual([0, 0.6, 0.75, 0.9]);
    expect(result.rubric.linkCompetencies).toBe(true);
  });

  it("explique la logique à l'IA et demande de signaler les doutes", () => {
    const { _prompt_configuration: cfg, template_a_remplir } = buildAITemplate({});
    expect(cfg.logique_de_la_grille.join(" ")).toMatch(/UN SEUL critère/);
    expect(cfg.ce_que_l_enseignant_te_fournit).toMatch(/OBLIGATOIRE/);
    expect(Array.isArray(template_a_remplir.aValider)).toBe(true);
  });

  it("respecte les options (points partiels, rétroaction, notes de l'enseignant)", () => {
    const off = buildAITemplate({ pointsPartiels: false, inclureFeedbackGlobal: false, instructionsIa: " Q1-5 : critère 1 " });
    expect(off._prompt_configuration.points).toMatch(/tout ou rien/);
    expect(off.template_a_remplir.feedbackMessages).toBeUndefined();
    expect(off._prompt_configuration.instructions_specifiques_utilisateur).toBe("Q1-5 : critère 1");
  });
});

describe("niveaux et tâches", () => {
  const levels = LEVEL_SCALES[4].map((l) => ({ ...l, desc: l.label }));

  it("choisit le niveau d'après le seuil minPct, avec repli sur maxPct pour les anciennes grilles", () => {
    expect(matchLevel(levels, 0.59).label).toBe("Insuffisant");
    expect(matchLevel(levels, 0.6).label).toBe("Partiel");
    expect(matchLevel(levels, 0.9).label).toBe("Excellent");
    const legacy = [{ label: "A", maxPct: 0, desc: "" }, { label: "B", maxPct: 0.65, desc: "" }, { label: "C", maxPct: 1, desc: "" }];
    expect(matchLevel(legacy, 0.7).label).toBe("B");
  });

  it("calcule les points d'une tâche (ancien format booléen et points partiels)", () => {
    const task = { pts: 6 };
    expect(taskPoints(task, true)).toBe(6);
    expect(taskPoints(task, false)).toBe(0);
    expect(taskPoints(task, undefined)).toBe(0);
    expect(taskPoints(task, 3.5)).toBe(3.5);
    expect(taskPoints(task, 99)).toBe(6);
    expect(taskPoints(task, -2)).toBe(0);
  });

  it("signale les écarts entre les tâches et la pondération", () => {
    const warnings = checkRubricSums([
      { title: "A", weight: 10, subCriteria: [{ pts: 4 }, { pts: 4 }] },
      { title: "B", weight: 5, subCriteria: [{ pts: 5 }] },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/« A »/);
  });

  it("transmet aValider à l'import", () => {
    const result = normalizeImportedRubric({
      criteria: [{ title: "C1", weight: 5, subCriteria: [{ label: "t", pts: 5 }] }],
      aValider: ["Q7 ambiguë", ""],
    });
    expect(result.aValider).toEqual(["Q7 ambiguë"]);
  });
});
