import { describe, expect, it } from "vitest";
import { sessionCountsLabel, shiftDateOneYear, suggestNextSessionName, sessionStatusInfo } from "./sessionHelpers";

describe("sessionHelpers", () => {
  it("propose le nom de la session suivante", () => {
    expect(suggestNextSessionName("Automne 2025")).toBe("Automne 2026");
    expect(suggestNextSessionName("Hiver")).toBe("Hiver (copie)");
    expect(suggestNextSessionName("")).toBe("");
  });
  it("décale une date d'un an", () => {
    expect(shiftDateOneYear("2024-08-26")).toBe("2025-08-26");
    expect(shiftDateOneYear("2024-02-29")).toBe("2025-02-28");
    expect(shiftDateOneYear("n'importe quoi")).toBe("");
  });
  it("résume le contenu", () => {
    expect(sessionCountsLabel({ courses: 1, rubrics: 3, groups: 2, students: 40 })).toBe("1 cours · 3 grilles · 2 groupes (40 étudiants)");
    expect(sessionCountsLabel({})).toBe("0 cours · 0 grille · 0 groupe");
  });
  it("retombe sur un état connu", () => {
    expect(sessionStatusInfo("archived").label).toBe("Archivée");
    expect(sessionStatusInfo("???").label).toBe("En cours");
  });
});
