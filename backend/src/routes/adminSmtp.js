const express = require("express");
const { z } = require("zod");
const { auth, isAdmin } = require("../middleware/auth");
const SmtpConfig = require("../models/SmtpConfig");
const {
  encryptSecret,
  sanitizeSmtpConfig,
  getActiveSmtpConfig,
} = require("../services/smtpConfigService");
const { testSmtpConnection } = require("../services/emailService");

const router = express.Router();
router.use(auth);
router.use(isAdmin);

const smtpSchema = z.object({
  host: z.string().trim().min(1, "Host requis"),
  port: z.coerce.number().int().min(1, "Port invalide").max(65535, "Port invalide"),
  secure: z.coerce.boolean(),
  user: z.string().trim().min(1, "Utilisateur SMTP requis"),
  password: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional()
  ),
  fromName: z.string().trim().min(1, "Nom expéditeur requis"),
  fromEmail: z.string().trim().email("Email expéditeur invalide"),
  isActive: z.coerce.boolean().optional(),
});

router.get("/smtp-config", async (_req, res) => {
  const config = await getActiveSmtpConfig();
  res.json({ config: sanitizeSmtpConfig(config) });
});

router.put("/smtp-config", async (req, res) => {
  try {
    const payload = smtpSchema.parse(req.body);
    const current = await getActiveSmtpConfig();
    const nextEncrypted = payload.password
      ? encryptSecret(payload.password)
      : current?.passwordEncrypted;

    if (!nextEncrypted) {
      return res.status(400).json({ message: "Mot de passe SMTP requis pour la premiere configuration." });
    }

    const config = await SmtpConfig.findOneAndUpdate(
      current ? { _id: current._id } : {},
      {
        host: payload.host,
        port: payload.port,
        secure: payload.secure,
        user: payload.user,
        passwordEncrypted: nextEncrypted,
        fromName: payload.fromName,
        fromEmail: payload.fromEmail,
        isActive: payload.isActive !== false,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ config: sanitizeSmtpConfig(config) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const detail = error.issues?.[0]?.message || "Validation échouée";
      return res.status(400).json({ message: `Configuration SMTP invalide: ${detail}` });
    }
    res.status(400).json({ message: "Configuration SMTP invalide", details: error.message });
  }
});

router.post("/smtp-config/test", async (req, res) => {
  try {
    if (req.body?.override) {
      const payload = smtpSchema.parse(req.body.override);
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: payload.host,
        port: payload.port,
        secure: payload.secure,
        auth: { user: payload.user, pass: payload.password || "" },
      });
      await transporter.verify();
      return res.json({ ok: true });
    }

    await testSmtpConnection();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: "Test SMTP echoue", details: error.message });
  }
});

module.exports = router;
