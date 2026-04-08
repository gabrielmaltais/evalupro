const nodemailer = require("nodemailer");
const { decryptSecret, getActiveSmtpConfig } = require("./smtpConfigService");

async function getTransporter() {
  const config = await getActiveSmtpConfig();
  if (!config) throw new Error("Aucune configuration SMTP active");
  const password = decryptSecret(config.passwordEncrypted);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: password },
  });
  return { transporter, config };
}

async function testSmtpConnection() {
  const { transporter } = await getTransporter();
  await transporter.verify();
  return { ok: true };
}

/**
 * @param {object} mailOptions - options Nodemailer (to, subject, text, html, attachments…)
 * @param {{ fromDisplayName?: string }} [options] - si fourni, remplace le nom d'affichage From (l'adresse reste fromEmail)
 */
async function sendMailWithCurrentConfig(mailOptions, options = {}) {
  const { transporter, config } = await getTransporter();
  const displayName = options.fromDisplayName != null && String(options.fromDisplayName).trim() !== ""
    ? String(options.fromDisplayName).trim()
    : config.fromName;
  const info = await transporter.sendMail({
    from: `${displayName} <${config.fromEmail}>`,
    ...mailOptions,
  });
  return info;
}

module.exports = { testSmtpConnection, sendMailWithCurrentConfig };
