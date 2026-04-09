/** Même règle que le backend : premier mot = prénom, le reste = nom. */
export function splitFullName(fullName) {
  const t = String(fullName || "").trim();
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
}

/** Affichage « Prénom Nom » à partir du document étudiant API. */
export function studentDisplayName(s) {
  if (!s) return "";
  const fn = String(s.firstName || "").trim();
  const ln = String(s.lastName || "").trim();
  const combined = [fn, ln].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return String(s.name || "").trim();
}
