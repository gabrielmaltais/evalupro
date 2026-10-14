import { describe, expect, it } from "vitest";
import { buildAITemplate, LEVEL_SCALES } from "./aiTemplate";
import { applyLevelToCriterion, checkRubricSums, matchLevel, normalizeImportedRubric, parseAiJson, taskPoints } from "./rubricTemplate";

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

describe("réponse de l'IA : import de bout en bout", () => {
  const aiAnswer = {
    title: "Systèmes réseau",
    taskTitle: "Examen final",
    linkCompetencies: true,
    criteria: [
      {
        id: "c1",
        title: "Installer et administrer les services d'infrastructure réseau",
        competencyElement: "Élément 2",
        weight: 0,
        color: "border-blue-500",
        levels: LEVEL_SCALES[4].map((l) => ({ ...l, desc: `Niveau ${l.label}` })),
        subCriteria: [
          { id: "c1-sc1", label: "Q1 OPNsense", pts: 6.5, feedback: "Revoir les interfaces." },
          { id: "c1-sc2", label: "Q2 Règles", pts: 8 },
          { id: "c1-sc3", label: "Q3 Tests", pts: 5.5 },
        ],
      },
      {
        id: "c1",
        title: "Planifier l'implantation de services infonuagiques",
        weight: 10,
        levels: LEVEL_SCALES[4].map((l) => ({ ...l, desc: `Niveau ${l.label}` })),
        subCriteria: [{ id: "c1-sc1", label: "Q4 Plan", pts: 4 }, { id: "c1-sc2", label: "Q5 Coûts", pts: 5 }],
      },
    ],
    aValider: ["Q12 couvre deux critères"],
  };

  it("déduit la pondération des tâches quand elle est laissée à 0 et évite les ids en double", () => {
    const result = normalizeImportedRubric(aiAnswer);
    expect(result.ok).toBe(true);
    const [c1, c2] = result.rubric.criteria;
    expect(c1.weight).toBe(20);
    expect(c1.id).not.toBe(c2.id);
    expect(new Set([...c1.subCriteria, ...c2.subCriteria].map((t) => t.id)).size).toBe(5);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Planifier/);
  });

  it("lit un JSON entouré de ```json et de texte", () => {
    const wrapped = "Voici la grille :\n```json\n" + JSON.stringify({ template_a_remplir: aiAnswer }) + "\n```\nBonne correction !";
    expect(parseAiJson(wrapped).template_a_remplir.title).toBe("Systèmes réseau");
    expect(parseAiJson("Résultat: " + JSON.stringify(aiAnswer) + " fin").title).toBe("Systèmes réseau");
    expect(() => parseAiJson("pas du json")).toThrow();
  });
});

describe("clic sur un niveau à la correction", () => {
  const levels = LEVEL_SCALES[4];
  it("sans tâches : note proportionnelle, arrondie au quart de point", () => {
    const c = { weight: 7 };
    expect(applyLevelToCriterion(c, levels[3])).toEqual({ score: 7, taskPoints: null });
    expect(applyLevelToCriterion(c, levels[1]).score).toBe(4.75);
    expect(applyLevelToCriterion(c, { maxPct: 0 }).score).toBe(0);
  });

  it("avec tâches : la note est la somme des tâches et ne dépasse jamais la pondération", () => {
    const c = { weight: 10, subCriteria: [{ id: "a", pts: 6 }, { id: "b", pts: 4 }] };
    expect(applyLevelToCriterion(c, levels[3])).toEqual({ score: 10, taskPoints: { a: 6, b: 4 } });
    const mid = applyLevelToCriterion(c, levels[2]);
    expect(mid.taskPoints).toEqual({ a: 5, b: 3.25 });
    expect(mid.score).toBe(8.25);
    const over = applyLevelToCriterion({ weight: 5, subCriteria: [{ id: "a", pts: 6 }] }, levels[3]);
    expect(over.score).toBe(5);
  });
});
