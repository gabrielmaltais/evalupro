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
    /**
     * Cours donnés cette session. Une ligne = un cours donné à un ou plusieurs groupes (en général un seul): le même
     * cours peut figurer plusieurs fois, chaque fois pour d'autres groupes. `rubrics` = évaluations cochées, ce qui
     * détermine ce que ces groupes peuvent corriger.
     */
    courses: {
      type: [
        new mongoose.Schema(
          {
            course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
            rubrics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rubric" }],
            groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
          },
          {}
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
