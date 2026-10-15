const mongoose = require("mongoose");

/**
 * Groupe commun (Ressources > Groupes): il existe une fois et se retrouve d'une session à l'autre par son nom.
 * Chaque session a son propre `Group` du même nom, qui porte ce qui change à chaque session: cours, évaluations
 * et inscriptions d'élèves.
 */
const commonGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "" },
    icon: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

commonGroupSchema.index({ createdBy: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("CommonGroup", commonGroupSchema);
