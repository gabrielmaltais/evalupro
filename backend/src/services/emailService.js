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

async function sendMailWithCurrentConfig(mailOptions) {
  const { transporter, config } = await getTransporter();
  const info = await transporter.sendMail({
    from: `${config.fromName} <${config.fromEmail}>`,
    ...mailOptions,
  });
  return info;
}

module.exports = { testSmtpConnection, sendMailWithCurrentConfig };
