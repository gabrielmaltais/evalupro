const mongoose = require("mongoose");

const evaluationEmailDeliverySchema = new mongoose.Schema(
  {
    evaluationId: { type: mongoose.Schema.Types.ObjectId, ref: "Evaluation", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    group: { type: String, default: "", index: true },
    examKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "" },
    sentAt: { type: Date },
    messageId: { type: String, default: "" },
    jobId: { type: String, required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

evaluationEmailDeliverySchema.index(
  { evaluationId: 1, studentId: 1, examKey: 1, owner: 1 },
  { unique: true, name: "uniq_eval_student_exam_owner" }
);

module.exports = mongoose.model("EvaluationEmailDelivery", evaluationEmailDeliverySchema);
