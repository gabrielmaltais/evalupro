const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    maxPct: { type: Number, required: true, min: 0, max: 1 },
    desc: { type: String, required: true },
  },
  { _id: false }
);

const subCriterionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    pts: { type: Number, required: true },
    feedback: { type: String, default: "" },
  },
  { _id: false }
);

const criterionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    weight: { type: Number, required: true, min: 0 },
    color: { type: String, default: "border-blue-500" },
    levels: { type: [levelSchema], default: [] },
    subCriteria: { type: [subCriterionSchema], default: [] },
  },
  { _id: false }
);

const rubricSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    taskTitle: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: false },
    criteria: { type: [criterionSchema], default: [] },
    feedbackMessages: {
      type: [{ minPct: Number, maxPct: Number, message: String }],
      default: [
        { minPct: 0, maxPct: 60, message: "Tu n'y es pas encore, mais ne te décourage pas ! Reviens sur les points manquants, consulte tes notes et n'hésite pas à demander de l'aide. Tu as la capacité de progresser et c'est en persévérant qu'on réussit." },
        { minPct: 60, maxPct: 75, message: "C'est un début ! Tu as saisi les bases, mais certains éléments méritent d'être approfondis. Prends le temps de revoir les points manqués — tu es sur la bonne voie pour t'améliorer." },
        { minPct: 75, maxPct: 85, message: "Beau travail ! Tu démontres une bonne maîtrise de l'ensemble du sujet. Quelques détails peuvent encore être peaufinés, mais tu peux être fier·e de ta performance." },
        { minPct: 85, maxPct: 95, message: "Excellent travail ! Tu maîtrises très bien la matière et ton investissement est visible. Continue comme ça, tu t'approches de la perfection !" },
        { minPct: 95, maxPct: 100, message: "Extraordinaire ! 🎉 Tu as accompli un travail remarquable et exceptionnel. C'est le résultat d'un effort soutenu et d'une vraie rigueur. Félicitations sincères !" },
      ],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rubric", rubricSchema);
