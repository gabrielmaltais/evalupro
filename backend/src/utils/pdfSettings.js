/** Réglages du PDF de correction (par enseignant). Les booléens activent / désactivent un élément; les textes acceptent des variables {etudiant} {prenom} {cours} {examen} {enseignant}. */
const DEFAULTS = {
  layout: "detaille",
  pageSize: "LETTER",
  palette: "carnet",
  headerLabel: "Rapport de correction",
  showDate: true,
  showPercent: true,
  showOpening: true,
  showHighlights: true,
  showStepVerdict: true,
  listAllQuestions: true,
  showObservations: true,
  showExpected: true,
  showInsights: true,
  showPriorityHint: true,
  showFinalMessage: true,
  showTeacherComment: true,
  greeting: "firstName",
  signatureText: "",
  footerText: "",
  showPageNumbers: true,
};

const ENUMS = {
  layout: ["compact", "detaille"],
  pageSize: ["LETTER", "A4"],
  palette: ["carnet", "ardoise", "bordeaux"],
  greeting: ["firstName", "none"],
};

const TEXTS = { headerLabel: 60, signatureText: 80, footerText: 120 };

/** Ne garde que les clés connues, avec le bon type; le reste retombe sur les valeurs par défaut. */
function sanitizePdfSettings(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  Object.entries(DEFAULTS).forEach(([key, def]) => {
    const v = src[key];
    if (ENUMS[key]) out[key] = ENUMS[key].includes(v) ? v : def;
    else if (typeof def === "boolean") out[key] = typeof v === "boolean" ? v : def;
    else out[key] = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, TEXTS[key] || 120) : def;
  });
  return out;
}

/** Remplace {variable} dans un texte; une variable inconnue est laissée telle quelle. */
function fill(text, vars) {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

module.exports = { DEFAULTS, ENUMS, sanitizePdfSettings, fill };
