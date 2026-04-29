import { describe, expect, it } from "vitest";
import { distributePoints, normalizeImportedRubric } from "./rubricTemplate";

describe("rubric template helpers", () => {
  it("distributes points without losing the total", () => {
    expect(distributePoints(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(distributePoints(10, 4).reduce((sum, value) => sum + value, 0)).toBe(10);
  });

  it("imports AI questions as one criterion per question with subquestions", () => {
    const result = normalizeImportedRubric({
      title: "Routage",
      taskTitle: "Lab OSPF",
      questions: [
        {
          question: "Configurer les voisins OSPF",
          points: 10,
          sousQuestions: [
            { texte: "Router ID configuré", points: 4 },
            { label: "Adjacence active", pts: 6, feedback: "Vérifiez les interfaces et les timers." },
          ],
          niveaux: [
            { label: "Absent", maxPct: 0, desc: "Non réalisé" },
            { label: "Complet", maxPct: 100, desc: "Tout fonctionne" },
          ],
        },
        {
          question: "Valider les routes",
          points: 5,
          sousQuestions: [{ label: "Routes présentes", points: 5 }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rubric.criteria).toHaveLength(2);
    expect(result.rubric.criteria[0]).toMatchObject({
      title: "Configurer les voisins OSPF",
      weight: 10,
    });
    expect(result.rubric.criteria[0].subCriteria).toHaveLength(2);
    expect(result.rubric.criteria[0].subCriteria.map((item) => item.pts)).toEqual([4, 6]);
    expect(result.rubric.criteria[0].levels[1].maxPct).toBe(1);
    expect(result.rubric.criteria[1].weight).toBe(5);
  });

  it("keeps a canonical criteria array importable", () => {
    const result = normalizeImportedRubric({
      courseTitle: "Systèmes",
      criteria: [
        {
          id: "c1",
          title: "Service DNS",
          weight: "12 pts",
          color: "not-a-color",
          levels: [{ label: "Réussi", maxPct: 1, desc: "Fonctionnel" }],
          subCriteria: [{ id: "sc1", label: "Zone directe", pts: 12 }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rubric.title).toBe("Systèmes");
    expect(result.rubric.criteria[0].weight).toBe(12);
    expect(result.rubric.criteria[0].color).toBe("border-blue-500");
    expect(result.rubric.criteria[0].subCriteria[0]).toMatchObject({ id: "sc1", pts: 12 });
  });
});
