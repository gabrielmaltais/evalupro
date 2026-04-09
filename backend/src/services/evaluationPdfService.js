const PDFDocument = require("pdfkit");

function toPlainObject(mapLike) {
  if (!mapLike) return {};
  if (mapLike instanceof Map) return Object.fromEntries(mapLike);
  if (typeof mapLike.toObject === "function") return mapLike.toObject();
  if (typeof mapLike === "object") return { ...mapLike };
  return {};
}

function sanitizeFilePart(v) {
  return String(v || "")
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function criterionKey(criterion, index) {
  if (criterion.id != null && criterion.id !== "") return String(criterion.id);
  if (criterion._id != null) return String(criterion._id);
  return String(index);
}

function getNumber(obj, key) {
  if (!obj) return undefined;
  const k = String(key);
  if (obj[k] !== undefined) return Number(obj[k]);
  if (obj[key] !== undefined) return Number(obj[key]);
  return undefined;
}

function getScore(scores, cid) {
  const o = toPlainObject(scores);
  const v = getNumber(o, cid);
  return v === undefined ? 0 : v;
}

function getSubBlock(subScores, cid) {
  const o = toPlainObject(subScores);
  const block = o[cid] ?? o[String(cid)];
  if (!block || typeof block !== "object") return {};
  return block;
}

function levelDescription(criterion, s, scoresObj, cid) {
  let descText = "Non évalué";
  const raw = getNumber(scoresObj, cid);
  if (s > 0 || raw === 0) {
    if (criterion.levels && criterion.levels.length > 0) {
      const pctC = s / (criterion.weight || 1);
      const sortedLevels = [...criterion.levels].sort((a, b) => a.maxPct - b.maxPct);
      let matchedLevel = sortedLevels[0];
      for (const lvl of sortedLevels) {
        if (pctC >= lvl.maxPct) matchedLevel = lvl;
      }
      descText = matchedLevel.desc || "Score attribué";
    } else {
      descText = "Score attribué";
    }
  }
  return descText;
}

function computeTotals(rubric, scoresObj) {
  let totalMax = 0;
  let totalScore = 0;
  (rubric.criteria || []).forEach((c, i) => {
    const cid = criterionKey(c, i);
    totalMax += c.weight || 0;
    totalScore += getScore(scoresObj, cid);
  });
  return { totalScore, totalMax };
}

function pickFeedbackMessage(rubric, finalPct) {
  const msgs = rubric.feedbackMessages;
  if (!msgs || !msgs.length) return null;
  return msgs.find((fm) => finalPct >= fm.minPct && finalPct <= fm.maxPct) || null;
}

function feedbackBandColors(finalPct) {
  if (finalPct < 60) return { border: "#f87171", bg: "#fef2f2", text: "#b91c1c" };
  if (finalPct < 75) return { border: "#fb923c", bg: "#fff7ed", text: "#c2410c" };
  if (finalPct < 85) return { border: "#facc15", bg: "#fefce8", text: "#a16207" };
  if (finalPct < 95) return { border: "#60a5fa", bg: "#eff6ff", text: "#1d4ed8" };
  return { border: "#4ade80", bg: "#f0fdf4", text: "#15803d" };
}

/** Aligné sur les classes Tailwind des critères (Evaluations.jsx / AdminRubric). */
function criterionStripeColor(criterion) {
  const raw = String(criterion.color || "border-blue-500").trim();
  const map = {
    "border-blue-500": "#3b82f6",
    "border-green-500": "#22c55e",
    "border-red-500": "#ef4444",
    "border-purple-500": "#a855f7",
    "border-orange-500": "#f97316",
    "border-gray-500": "#6b7280",
  };
  return map[raw] || "#3b82f6";
}

function drawCheckbox(doc, x, y, size, isChecked) {
  if (isChecked) {
    doc.rect(x, y, size, size).fillAndStroke("#9333ea", "#9333ea");
    doc.save();
    doc.moveTo(x + size * 0.22, y + size * 0.52)
      .lineTo(x + size * 0.42, y + size * 0.72)
      .lineTo(x + size * 0.82, y + size * 0.28)
      .lineWidth(size * 0.12)
      .strokeColor("#ffffff")
      .stroke();
    doc.restore();
  } else {
    doc.rect(x, y, size, size).strokeColor("#d1d5db").lineWidth(0.6).stroke();
  }
}

function ensureSpace(doc, neededHeight, extraBottom = 0) {
  const available = doc.page.height - doc.page.margins.bottom - doc.y - extraBottom;
  if (neededHeight > available) {
    doc.addPage();
  }
}

/**
 * Aligne le rendu sur le template #pdf-content de Evaluations.jsx (export manuel).
 * showDatePdf côté UI n'est pas persisté : on n'affiche pas la date (comportement par défaut de la page).
 */
function createEvaluationPdfBuffer(evaluation, rubric) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const scores = toPlainObject(evaluation.scores);
    const comments = toPlainObject(evaluation.comments);
    const subScores = toPlainObject(evaluation.subScores);

    const { totalScore, totalMax } = computeTotals(rubric, scores);
    const displayScore = Math.round(totalScore * 10) / 10;
    const finalPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    let y = doc.page.margins.top;
    const bottomBuffer = 6;
    const getPageBottomY = () => doc.page.height - doc.page.margins.bottom - bottomBuffer;
    const ensureCursorSpace = (cursorY, neededHeight) => {
      if (cursorY + neededHeight > getPageBottomY()) {
        doc.addPage();
        return doc.y;
      }
      return cursorY;
    };

    // En-tête : hauteurs dynamiques (évite le chevauchement titre / sous-titre si le titre passe sur 2 lignes)
    const split = 0.58;
    const colW = pageWidth * split;
    const rightW = pageWidth * (1 - split);
    const rightX = left + colW;
    const titleStr = rubric.title || "Évaluation";
    const taskStr = String(rubric.taskTitle || "").toUpperCase();

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827");
    const titleH = doc.heightOfString(titleStr, { width: colW });
    doc.text(titleStr, left, y, { width: colW });

    const gapTitleTask = 8;
    const subY = y + titleH + gapTitleTask;
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
    const taskH = taskStr ? doc.heightOfString(taskStr, { width: colW }) : 0;
    if (taskStr) doc.text(taskStr, left, subY, { width: colW });

    const leftBlockH = titleH + gapTitleTask + taskH;
    const noteLabelH = 12;
    const scoreH = 32;
    const rightBlockH = noteLabelH + scoreH;
    const headerH = Math.max(leftBlockH, rightBlockH);

    doc.fontSize(9).fillColor("#6b7280").text("Note Finale", rightX, y, { width: rightW, align: "right" });
    doc.fontSize(28).fillColor("#2563eb").text(`${displayScore}/${totalMax}`, rightX, y + noteLabelH, { width: rightW, align: "right" });

    y += headerH + 10;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#111827").lineWidth(2).stroke();
    y += 14;
    doc.y = y;

    // Bloc étudiant (sans date : défaut showDatePdf = false sur la page Évaluations)
    const boxTop = doc.y;
    doc.rect(left, boxTop, pageWidth, 52).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(8).fillColor("#9ca3af").text("ÉTUDIANT", left + 12, boxTop + 10);
    doc.fontSize(14).fillColor("#111827").text(evaluation.studentName || "Non spécifié", left + 12, boxTop + 22, { width: pageWidth - 24 });
    doc.y = boxTop + 58;
    doc.moveDown(1);

    // Critères (barre bleue à gauche après calcul de la hauteur du bloc)
    (rubric.criteria || []).forEach((c, i) => {
      const cid = criterionKey(c, i);
      const s = getScore(scores, cid);
      const descText = levelDescription(c, s, scores, cid);
      const commentLine = comments[cid] || comments[String(cid)];
      const subScoreBlock = getSubBlock(subScores, cid);
      // Évite les grands blancs: on n'impose pas tout le critère sur une nouvelle page.
      // On garantit seulement l'espace minimal pour l'entête du critère.
      ensureSpace(doc, 46, 6);

      const rowTop = doc.y;
      const rowPage = doc.page;
      const textLeft = left + 14;
      let cursorY = rowTop + 4;

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text(c.title || "Critère", textLeft, cursorY, { width: pageWidth - 100 });
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(String(s), left + pageWidth - 86, cursorY, { width: 36, align: "right" });
      doc.font("Helvetica").fontSize(9).fillColor("#9ca3af").text(`/ ${c.weight || 0}`, left + pageWidth - 48, cursorY, { width: 40, align: "right" });

      cursorY += 16;
      doc.fontSize(9).fillColor("#4b5563").text(descText, textLeft, cursorY, { width: pageWidth - 24 });
      cursorY += 14;

      if (c.subCriteria && c.subCriteria.length) {
        const chkSize = 8;
        const chkGap = 4;
        const labelX = textLeft + chkSize + chkGap + 2;
        const labelW = pageWidth - 24 - chkSize - chkGap - 2;
        c.subCriteria.forEach((sc) => {
          cursorY = ensureCursorSpace(cursorY, 18);
          const isChecked = !!(subScoreBlock[sc.id] || subScoreBlock[String(sc.id)]);
          const labelText = `${sc.label} (${sc.pts > 0 ? "+" : ""}${sc.pts} pts)`;
          doc.font("Helvetica").fontSize(8);
          const labelH = doc.heightOfString(labelText, { width: labelW });
          const rowH = Math.max(chkSize, labelH);
          const boxY = cursorY + (rowH - chkSize) / 2;
          drawCheckbox(doc, textLeft, boxY, chkSize, isChecked);
          doc.fillColor(isChecked ? "#1f2937" : "#9ca3af").text(labelText, labelX, cursorY, { width: labelW });
          cursorY += rowH + 4;

          if (!isChecked && sc.feedback) {
            const pad = 4;
            const boxInnerW = pageWidth - 36;
            const fbText = `⚠ ${sc.feedback}`;
            doc.fontSize(8);
            const fbTextH = doc.heightOfString(fbText, { width: boxInnerW - pad * 2 });
            const fbH = fbTextH + pad * 2;
            cursorY = ensureCursorSpace(cursorY, fbH + 8);
            const fbX = textLeft + 10;
            const fbY = cursorY;
            doc.rect(fbX, fbY, pageWidth - 28, fbH).fillAndStroke("#fef2f2", "#fecaca");
            doc.fillColor("#b91c1c").text(fbText, fbX + pad, fbY + pad, { width: boxInnerW - pad * 2 });
            cursorY = fbY + fbH + 6;
          }
        });
      }

      if (commentLine) {
        cursorY = ensureCursorSpace(cursorY, 16);
        doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6b7280").text(`Note: ${commentLine}`, textLeft, cursorY + 2, { width: pageWidth - 24 });
        doc.font("Helvetica");
        cursorY += 14;
      }

      const blockBottom = cursorY + 6;
      const stripeH = Math.max(28, blockBottom - rowTop);
      // Si le critère se poursuit sur une autre page, on n'étire pas la bande verticale
      // entre deux pages pour éviter les artefacts d'espacement.
      if (doc.page === rowPage) {
        doc.save();
        doc.rect(left, rowTop, 4, stripeH).fill(criterionStripeColor(c));
        doc.restore();
      }

      doc.y = blockBottom > getPageBottomY() ? getPageBottomY() : blockBottom;
      if (doc.y >= getPageBottomY()) {
        doc.addPage();
      }
      doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor("#f3f4f6").lineWidth(0.5).stroke();
      doc.moveDown(0.6);
    });

    // Synthèse enseignant
    if (evaluation.generalComment) {
      doc.fontSize(10);
      const summaryH = 44 + doc.heightOfString(evaluation.generalComment, {
        width: pageWidth,
        align: "justify",
      });
      ensureSpace(doc, summaryH, 6);

      doc.moveDown(0.8);
      doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.6);
      doc.fontSize(10).fillColor("#111827").text("SYNTHÈSE DE L'ENSEIGNANT", left, doc.y, { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#374151").text(evaluation.generalComment, left, doc.y, {
        width: pageWidth,
        align: "justify",
      });
    }

    // Rétroaction finale (feedbackMessages)
    const match = pickFeedbackMessage(rubric, finalPct);
    if (match && match.message) {
      doc.fontSize(10);
      const feedbackTextH = doc.heightOfString(match.message, { width: pageWidth - 20 });
      const feedbackH = Math.max(36, feedbackTextH + 16) + 20;
      ensureSpace(doc, feedbackH, 6);

      doc.moveDown(1);
      doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.8);
      const bandTop = doc.y;
      const colors = feedbackBandColors(finalPct);
      const bandH = Math.max(36, feedbackTextH + 16);
      doc.rect(left + 3, bandTop, pageWidth - 3, bandH).fillAndStroke(colors.bg, colors.bg);
      doc.rect(left, bandTop, 4, bandH).fillAndStroke(colors.border, colors.border);
      doc.fontSize(10).fillColor(colors.text).text(match.message, left + 14, bandTop + 10, { width: pageWidth - 20 });
      doc.y = bandTop + bandH + 8;
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
