/**
 * Découpe un nom complet importé (premier mot = prénom, le reste = nom).
 */
function splitFullName(fullName) {
  const t = String(fullName || "").trim();
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
}

function buildFullName(firstName, lastName) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ").trim();
}

/**
 * Prénom pour salutation (ex. courriel « Bonjour Jean »).
 */
function studentFirstNameFromDoc(student) {
  if (!student) return "";
  const fn = String(student.firstName || "").trim();
  if (fn) return fn;
  return splitFullName(student.name).firstName;
}

function studentLastNameFromDoc(student) {
  if (!student) return "";
  const ln = String(student.lastName || "").trim();
  if (ln) return ln;
  return splitFullName(student.name).lastName;
}

/**
 * Nom complet « Prénom Nom » pour affichage / PDF / studentName.
 */
function studentFullNameFromDoc(student) {
  if (!student) return "";
  const full = buildFullName(student.firstName, student.lastName);
  if (full) return full;
  return String(student.name || "").trim();
}

/**
 * Corps requête création / import : accepte name seul ou firstName+lastName.
 */
function normalizeStudentPayload(body) {
  let firstName = String(body.firstName ?? "").trim();
  let lastName = String(body.lastName ?? "").trim();
  const legacyName = String(body.name ?? "").trim();
  if (!firstName && !lastName && legacyName) {
    const sp = splitFullName(legacyName);
    firstName = sp.firstName;
    lastName = sp.lastName;
  }
  const name = buildFullName(firstName, lastName) || legacyName;
  if (!name) {
    const err = new Error("Nom requis (prénom et nom)");
    err.statusCode = 400;
    throw err;
  }
  return {
    firstName,
    lastName,
    name,
    email: body.email,
    group: body.group,
  };
}

module.exports = {
  splitFullName,
  buildFullName,
  studentFirstNameFromDoc,
  studentLastNameFromDoc,
  studentFullNameFromDoc,
  normalizeStudentPayload,
};
