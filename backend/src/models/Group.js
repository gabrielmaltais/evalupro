const mongoose = require("mongoose");

/**
 * Groupe d'une session. Il référence des ressources communes (cours, grilles) sans les posséder:
 * les grilles proposées en correction sont celles des cours du groupe, plus `extraRubrics`
 * pour les grilles sans cours associées directement au groupe.
 */
const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    extraRubrics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rubric" }],
    /** Couleur hex (#rrggbb ou #rgb) pour pastille / repère (ancien GroupStyle). */
    color: { type: String, default: "" },
    /** Classes Font Awesome (ancien GroupStyle). */
    icon: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

groupSchema.index({ createdBy: 1, session: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Group", groupSchema);
