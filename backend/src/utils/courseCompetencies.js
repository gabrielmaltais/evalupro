const crypto = require("crypto");

/**
 * Nettoie la liste de compétences d'un cours : retire les lignes vides, garde un id stable
 * (généré s'il manque ou s'il est en double) et borne la longueur des textes.
 */
function normalizeCompetencies(list) {
  const used = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const title = String(item?.title ?? "").trim().slice(0, 500);
    if (!title) return;
    let id = String(item?.id ?? "").trim().slice(0, 64);
    if (!id || used.has(id)) id = `comp-${crypto.randomBytes(4).toString("hex")}`;
    used.add(id);
    out.push({ id, title, description: String(item?.description ?? "").trim().slice(0, 2000) });
  });
  return out.slice(0, 100);
}

module.exports = { normalizeCompetencies };
