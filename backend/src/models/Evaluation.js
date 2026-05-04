const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    date: { type: String, required: true },
    scores: { type: Map, of: Number, default: {} },
    subScores: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    comments: { type: Map, of: String, default: {} },
    generalComment: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    totalScore: { type: Number, default: 0 },
    totalMax: { type: Number, default: 0 },
    rubric: { type: mongoose.Schema.Types.ObjectId, ref: "Rubric", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Repère visuel optionnel (pastille / icône) pour tri visuel en correction */
    markerColor: { type: String, default: "" },
    markerIcon: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Evaluation", evaluationSchema);
