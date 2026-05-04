export function markerIconClasses(icon) {
  const t = String(icon || "").trim();
  if (!t) return "";
  if (/\bfa-(solid|regular|brands)\b/.test(t)) return t;
  return "fa-solid " + t;
}

export const MARKER_ICON_PRESET_OPTIONS = [
  { label: "\u2014 Aucune \u2014", value: "" },
  { label: "\u00c9tudiants", value: "fa-users" },
  { label: "Livre", value: "fa-book" },
  { label: "Code", value: "fa-code" },
  { label: "Laboratoire", value: "fa-flask" },
  { label: "Stylo", value: "fa-pen" },
  { label: "Graduation", value: "fa-graduation-cap" },
  { label: "\u00c9toile", value: "fa-star" },
  { label: "Dossier", value: "fa-folder" },
  { label: "Calendrier", value: "fa-calendar" },
  { label: "Rep\u00e8re", value: "fa-location-dot" },
];
