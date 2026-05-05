const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const SmtpConfig = require("../models/SmtpConfig");

const ALGO = "aes-256-gcm";
const PLAIN_PREFIX = "plain:";

function getKey(optional = false) {
  let keyRaw = process.env.SMTP_CONFIG_ENCRYPTION_KEY || "";
  // Fallback de robustesse: certaines commandes bootstrappent l'app sans server.js
  // (qui charge dotenv). On recharge ici backend/.env si nécessaire.
  if (!keyRaw) {
    dotenv.config({ path: path.resolve(__dirname, "../../.env") });
    keyRaw = process.env.SMTP_CONFIG_ENCRYPTION_KEY || "";
  }
  keyRaw = String(keyRaw).trim();
  if (!keyRaw) {
    if (optional) return null;
    throw new Error("SMTP_CONFIG_ENCRYPTION_KEY manquante");
  }
  return crypto.createHash("sha256").update(keyRaw).digest();
}

function encryptSecret(plainText) {
  const normalized = String(plainText || "");
  const key = getKey(true);
  // Fallback runtime: si la clé n'est pas injectée en prod, on stocke en clair préfixé
  // pour ne pas bloquer l'envoi SMTP. (Recommandé: réinjecter la clé et réenregistrer.)
  if (!key) {
    return `${PLAIN_PREFIX}${Buffer.from(normalized, "utf8").toString("base64")}`;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(payload) {
  const raw = String(payload || "");
  if (raw.startsWith(PLAIN_PREFIX)) {
    const content = raw.slice(PLAIN_PREFIX.length);
    return Buffer.from(content, "base64").toString("utf8");
  }
  const [ivB64, tagB64, contentB64] = raw.split(":");
  if (!ivB64 || !tagB64 || !contentB64) throw new Error("Secret SMTP invalide");
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(contentB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function getActiveSmtpConfig() {
  return SmtpConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
}

function sanitizeSmtpConfig(configDoc) {
  if (!configDoc) return null;
  return {
    id: configDoc._id,
    host: configDoc.host,
    port: configDoc.port,
    secure: configDoc.secure,
    user: configDoc.user,
    fromName: configDoc.fromName,
    fromEmail: configDoc.fromEmail,
    emailSubjectTemplate: configDoc.emailSubjectTemplate,
    emailBodyTemplate: configDoc.emailBodyTemplate,
    isActive: configDoc.isActive,
    updatedAt: configDoc.updatedAt,
  };
}

module.exports = {
  encryptSecret,
  decryptSecret,
  getActiveSmtpConfig,
  sanitizeSmtpConfig,
};
