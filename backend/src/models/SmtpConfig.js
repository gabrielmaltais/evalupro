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
    /** Modèles pour les envois : {studentFirstName}, {studentLastName}, {studentName} (complet), {examTitle}, {courseTitle}, {teacherName}, {group} */
    emailSubjectTemplate: { type: String, trim: true, default: "Copie d'évaluation — {examTitle}" },
    emailBodyTemplate: {
      type: String,
      trim: true,
      default:
        "Bonjour {studentFirstName},\n\nVeuillez trouver ci-joint votre copie d'évaluation pour « {examTitle} » ({courseTitle}).\n\nCordialement,\n{teacherName}",
    },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SmtpConfig", smtpConfigSchema);
