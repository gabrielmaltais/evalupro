import { describe, expect, it } from "vitest";
import { daysUntil, sessionsArchivingSoon, sessionCountsLabel, shiftDateOneYear, suggestNextSessionName, sessionStatusInfo } from "./sessionHelpers";

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
  it("calcule les jours restants et les sessions à surveiller", () => {
    expect(daysUntil("2026-01-10", "2026-01-07")).toBe(3);
    expect(daysUntil("2026-01-05", "2026-01-07")).toBe(-2);
    expect(daysUntil("x", "2026-01-07")).toBeNull();
    const list = [
      { _id: "a", archiveAfter: "2026-01-09", autoArchive: true },
      { _id: "b", archiveAfter: "2026-06-01", autoArchive: true },
      { _id: "c", archiveAfter: "2026-01-08", autoArchive: false },
      { _id: "d", archiveAfter: "2026-01-08", archivedAt: "2026-01-01" },
    ];
    expect(sessionsArchivingSoon(list, 7, "2026-01-07").map((x) => x.session._id)).toEqual(["a"]);
  });
});
