/** Libellés et styles des états d'une session (calculés côté serveur dans `status`). */
export const SESSION_STATUS = {
  upcoming: { label: "À venir", cls: "bg-sky-100 text-sky-800" },
  ongoing: { label: "En cours", cls: "bg-emerald-100 text-emerald-800" },
  grace: { label: "Terminée (délai de grâce)", cls: "bg-amber-100 text-amber-800" },
  due: { label: "À archiver", cls: "bg-orange-100 text-orange-800" },
  archived: { label: "Archivée", cls: "bg-gray-200 text-gray-700" },
};

export function sessionStatusInfo(status) {
  return SESSION_STATUS[status] || SESSION_STATUS.ongoing;
}

/** "2026-01-12" → "12 janv. 2026"; retourne la valeur telle quelle si elle est invalide. */
export function formatSessionDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
  if (!m) return String(str || "");
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Résumé "2 cours · 3 grilles · 1 groupe (24 étudiants)" d'une session. */
export function sessionCountsLabel(counts = {}) {
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const parts = [
    plural(counts.courses || 0, "cours", "cours"),
    plural(counts.rubrics || 0, "grille", "grilles"),
    plural(counts.groups || 0, "groupe", "groupes"),
  ];
  const students = counts.students || 0;
  return `${parts.join(" · ")}${students ? ` (${plural(students, "étudiant", "étudiants")})` : ""}`;
}

/** Nom proposé pour la session suivante: "Automne 2025" → "Automne 2026", sinon "… (copie)". */
export function suggestNextSessionName(name) {
  const m = /^(.*?)(\d{4})\s*$/.exec(String(name || "").trim());
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return name ? `${name} (copie)` : "";
}

/** Décale une date AAAA-MM-JJ d'un an (29 févr. → 28 févr.). */
export function shiftDateOneYear(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
  if (!m) return "";
  const y = Number(m[1]) + 1;
  let day = Number(m[3]);
  if (m[2] === "02" && day === 29) day = 28;
  return `${y}-${m[2]}-${String(day).padStart(2, "0")}`;
}
