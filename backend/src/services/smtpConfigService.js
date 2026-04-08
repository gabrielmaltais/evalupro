const crypto = require("crypto");
const SmtpConfig = require("../models/SmtpConfig");

const ALGO = "aes-256-gcm";

function getKey() {
  const keyRaw = process.env.SMTP_CONFIG_ENCRYPTION_KEY || "";
  if (!keyRaw) throw new Error("SMTP_CONFIG_ENCRYPTION_KEY manquante");
  return crypto.createHash("sha256").update(keyRaw).digest();
}

function encryptSecret(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(payload) {
  const [ivB64, tagB64, contentB64] = String(payload || "").split(":");
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
