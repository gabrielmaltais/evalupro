const PDFDocument = require("pdfkit");

function toObj(mapLike) {
  if (!mapLike) return {};
  if (typeof mapLike.toObject === "function") return mapLike.toObject();
  return mapLike;
}

function sanitizeFilePart(v) {
  return String(v || "")
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function createEvaluationPdfBuffer(evaluation, rubric) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const scores = toObj(evaluation.scores);
    const comments = toObj(evaluation.comments);
    const subScores = toObj(evaluation.subScores);

    doc.fontSize(18).text(rubric.title || "Evaluation", { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#666").text(rubric.taskTitle || "");
    doc.moveDown(0.8);
    doc.fillColor("#000");
    doc.fontSize(11).text(`Etudiant: ${evaluation.studentName || "Non specifie"}`);
    doc.text(`Date: ${evaluation.date || ""}`);
    doc.text(`Note finale: ${evaluation.totalScore || 0}/${evaluation.totalMax || 0}`);
    doc.moveDown(1);

    (rubric.criteria || []).forEach((criterion) => {
      const cid = criterion.id || String(criterion._id || "");
      const sc = Number(scores[cid] || 0);
      doc.fontSize(12).fillColor("#111").text(`${criterion.title} (${sc}/${criterion.weight || 0})`);
      if (comments[cid]) {
        doc.fontSize(10).fillColor("#666").text(`Commentaire: ${comments[cid]}`);
      }
      if (criterion.subCriteria?.length) {
        const selected = subScores[cid] || {};
        criterion.subCriteria.forEach((sub) => {
          const checked = selected[sub.id] ? "x" : " ";
          doc.fontSize(9).fillColor("#555").text(`[${checked}] ${sub.label} (${sub.pts > 0 ? "+" : ""}${sub.pts})`);
        });
      }
      doc.moveDown(0.5);
    });

    if (evaluation.generalComment) {
      doc.moveDown(0.8);
      doc.fontSize(12).fillColor("#111").text("Synthese de l'enseignant");
      doc.fontSize(10).fillColor("#444").text(evaluation.generalComment);
    }

    doc.end();
  });
}

function getEvaluationPdfFileName(evaluation, rubric) {
  const exam = sanitizeFilePart(rubric.taskTitle || rubric.title || "Evaluation");
  const student = sanitizeFilePart(evaluation.studentName || "Etudiant");
  return `${exam}-${student}.pdf`;
}

module.exports = { createEvaluationPdfBuffer, getEvaluationPdfFileName };
