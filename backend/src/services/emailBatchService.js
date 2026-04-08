const crypto = require("crypto");
const Evaluation = require("../models/Evaluation");
const Student = require("../models/Student");
const User = require("../models/User");
const EvaluationEmailDelivery = require("../models/EvaluationEmailDelivery");
const { sendMailWithCurrentConfig } = require("./emailService");
const { createEvaluationPdfBuffer, getEvaluationPdfFileName } = require("./evaluationPdfService");
const { buildEvaluationEmailParts } = require("./evaluationEmailTemplate");
const { getActiveSmtpConfig } = require("./smtpConfigService");

const batchProgress = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeJobId() {
  return `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function examKeyFromRubric(rubric) {
  return `${rubric._id}:${rubric.version || 1}`;
}

function setProgress(jobId, patch) {
  const current = batchProgress.get(jobId) || {};
  batchProgress.set(jobId, { ...current, ...patch, updatedAt: new Date().toISOString() });
}

function getProgress(jobId) {
  return batchProgress.get(jobId) || null;
}

async function selectEvaluationsForBatch({ ownerId, group, rubricId }) {
  const students = await Student.find({ createdBy: ownerId, group }).select("_id email name group");
  const validStudents = students.filter((s) => s.email);
  const studentIds = validStudents.map((s) => s._id);
  if (!studentIds.length) return [];

  const evaluations = await Evaluation.find({ owner: ownerId, rubric: rubricId, studentId: { $in: studentIds } })
    .populate("rubric")
    .sort({ createdAt: -1 });

  const byStudent = new Map();
  evaluations.forEach((ev) => {
    const sid = String(ev.studentId || "");
    if (!byStudent.has(sid)) byStudent.set(sid, ev);
  });
  return validStudents
    .map((student) => {
      const ev = byStudent.get(String(student._id));
      if (!ev) return null;
      return { student, evaluation: ev };
    })
    .filter(Boolean);
}

async function runBatchJob({
  jobId,
  owner,
  group,
  rubricId,
  skipAlreadySent = true,
  allowResendFailed = true,
  delayMs = Number(process.env.BATCH_DELAY_MS || 700),
}) {
  const targets = await selectEvaluationsForBatch({ ownerId: owner._id, group, rubricId });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const smtpConfig = await getActiveSmtpConfig();
  if (!smtpConfig) {
    setProgress(jobId, {
      status: "failed",
      error: "Aucune configuration SMTP active",
      total: targets.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      processed: 0,
    });
    return;
  }

  const ownerDoc = await User.findById(owner._id).select("name");
  const teacherName = (ownerDoc && ownerDoc.name) || owner.name || "Enseignant";
  const ownerForTemplate = { ...owner, name: teacherName };

  setProgress(jobId, {
    status: "running",
    total: targets.length,
    sent,
    failed,
    skipped,
    processed: 0,
  });

  for (const target of targets) {
    const { student, evaluation } = target;
    const examKey = examKeyFromRubric(evaluation.rubric);
    const existing = await EvaluationEmailDelivery.findOne({
      evaluationId: evaluation._id,
      studentId: student._id,
      owner: owner._id,
      examKey,
    });

    if (existing && existing.status === "sent" && skipAlreadySent) {
      skipped += 1;
      existing.status = "skipped";
      existing.jobId = jobId;
      existing.lastError = "";
      await existing.save();
      setProgress(jobId, { sent, failed, skipped, processed: sent + failed + skipped });
      continue;
    }

    if (existing && existing.status === "failed" && !allowResendFailed) {
      skipped += 1;
      setProgress(jobId, { sent, failed, skipped, processed: sent + failed + skipped });
      continue;
    }

    let delivery = existing;
    if (!delivery) {
      delivery = await EvaluationEmailDelivery.create({
        evaluationId: evaluation._id,
        studentId: student._id,
        group: student.group || "",
        examKey,
        status: "queued",
        attempts: 0,
        owner: owner._id,
        jobId,
      });
    } else {
      delivery.status = "queued";
      delivery.jobId = jobId;
      await delivery.save();
    }

    try {
      const pdfBuffer = await createEvaluationPdfBuffer(evaluation, evaluation.rubric);
      const filename = getEvaluationPdfFileName(evaluation, evaluation.rubric);
      const { subject, text } = buildEvaluationEmailParts(smtpConfig, {
        owner: ownerForTemplate,
        student,
        rubric: evaluation.rubric,
      });
      const info = await sendMailWithCurrentConfig(
        {
          to: student.email,
          subject,
          text,
          attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
        },
        { fromDisplayName: teacherName }
      );

      sent += 1;
      delivery.status = "sent";
      delivery.attempts += 1;
      delivery.lastError = "";
      delivery.sentAt = new Date();
      delivery.messageId = info.messageId || "";
      await delivery.save();
    } catch (error) {
      failed += 1;
      delivery.status = "failed";
      delivery.attempts += 1;
      delivery.lastError = String(error.message || error);
      await delivery.save();
    }

    setProgress(jobId, { sent, failed, skipped, processed: sent + failed + skipped });
    if (delayMs > 0) await sleep(delayMs);
  }

  setProgress(jobId, { status: "completed", sent, failed, skipped, processed: sent + failed + skipped });
}

function startBatchJob(params) {
  const jobId = makeJobId();
  setProgress(jobId, { status: "queued", total: 0, sent: 0, failed: 0, skipped: 0, processed: 0 });
  runBatchJob({ jobId, ...params }).catch((error) => {
    setProgress(jobId, { status: "failed", error: String(error.message || error) });
  });
  return jobId;
}

module.exports = {
  startBatchJob,
  getProgress,
  selectEvaluationsForBatch,
};
