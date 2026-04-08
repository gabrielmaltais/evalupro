const mongoose = require("mongoose");

const smtpConfigSchema = new mongoose.Schema(
  {
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, min: 1, max: 65535 },
    secure: { type: Boolean, default: false },
    user: { type: String, required: true, trim: true },
    passwordEncrypted: { type: String, required: true },
    fromName: { type: String, default: "EvaluPro", trim: true },
    fromEmail: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SmtpConfig", smtpConfigSchema);
