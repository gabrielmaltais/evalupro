const mongoose = require("mongoose");

const competencySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    // Compétence ou critère de performance tel qu'il figure au plan de cours (devient un critère de la grille).
    title: { type: String, required: true, trim: true },
    // Précisions utiles à l'IA (éléments, contexte, énoncé complet du critère).
    description: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, default: "", trim: true },
    competencies: { type: [competencySchema], default: [] },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

courseSchema.index({ createdBy: 1, title: 1 });

module.exports = mongoose.model("Course", courseSchema);
