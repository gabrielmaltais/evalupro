const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    maxPct: { type: Number, required: true, min: 0, max: 1 },
    desc: { type: String, required: true },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rubric", rubricSchema);
