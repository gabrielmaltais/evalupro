const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** AAAA-MM-JJ */
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    /** Jours après la fin de session avant l'archivage automatique (temps pour finir corrections et envois). */
    graceDays: { type: Number, default: 7, min: 0, max: 365 },
    autoArchive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, enum: ["", "manual", "auto"], default: "" },
    /** Cours de la session et, pour chacun, les évaluations (grilles) importées: détermine ce qu'on peut corriger. */
    courses: {
      type: [
        new mongoose.Schema(
          {
            course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
            rubrics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rubric" }],
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

sessionSchema.index({ createdBy: 1, startDate: -1 });

module.exports = mongoose.model("Session", sessionSchema);
