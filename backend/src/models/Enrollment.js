const mongoose = require("mongoose");

/** Inscription d'un élève (fiche permanente) dans un groupe; un élève a au plus un groupe par session. */
const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, session: 1 }, { unique: true });
enrollmentSchema.index({ group: 1 });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
