const PDFDocument = require("pdfkit");
const { toPlainObject, criterionKey, computeEvaluationTotals } = require("../utils/evaluationTotals");

function sanitizeFilePart(v) {
  return String(v || "")
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
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

function levelThreshold(level) {
  return Number.isFinite(level && level.minPct) ? level.minPct : (level && level.maxPct) || 0;
}

// `true` (ancien format) = tous les points; nombre = points partiels; sinon 0.
function taskPoints(task, value) {
  const max = Number(task.pts) || 0;
  if (value === true) return max;
  const n = Number(value);
  if (value === false || value === null || value === undefined || value === "" || !Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, Math.min(0, max)), Math.max(0, max));
}

function computeTotals(rubric, scoresObj) {
  return computeEvaluationTotals(rubric, scoresObj);
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
    "border-indigo-500": "#6366f1",
    "border-cyan-500": "#06b6d4",
    "border-yellow-500": "#eab308",
  };
  return map[raw] || "#3b82f6";
}

const MISSED_KEY = "_manques";

// Même règle qu'à l'écran (frontend/src/lib/rubricTemplate.js taskFeedback): quand la tâche propose des
// éléments à cocher, seule la sélection de l'enseignant sert; sinon, le texte général de la tâche.
function taskFeedback(task, missed) {
  const list = (missed || []).filter(Boolean);
  if (!list.length) return task.checks && task.checks.length ? "" : task.feedback || "";
  const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function pickLevel(levels, pct) {
  if (!levels || !levels.length) return null;
  const sorted = [...levels].sort((a, b) => levelThreshold(a) - levelThreshold(b));
  let m = sorted[0];
  for (const l of sorted) if (pct >= levelThreshold(l)) m = l;
  return m;
}

// Helvetica (WinAnsi) n'affiche ni emoji ni symboles: on les retire pour éviter les caractères parasites.
function latin(text) {
  return String(text || "").replace(/[^ -~ -ÿ‘’“”–—…Œœ]/g, "").replace(/\s+/g, " ").trim();
}

function formatDate(iso) {
  try {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    return d.toLocaleDateString("fr-CA", { dateStyle: "long", timeZone: "UTC" });
  } catch {
    return "";
  }
}

const NUM = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

const STATUS = {
  full: { fg: "#15803d", bg: "#dcfce7", name: "Atteint" },
  partial: { fg: "#b45309", bg: "#fef3c7", name: "Partiellement atteint" },
  none: { fg: "#b91c1c", bg: "#fee2e2", name: "Non atteint" },
  open: { fg: "#6b7280", bg: "#f3f4f6", name: "Non évalué" },
};

function statusOf(evaluated, earned, max) {
  if (!evaluated) return STATUS.open;
  if (max > 0 && earned >= max) return STATUS.full;
  if (earned <= 0) return STATUS.none;
  return STATUS.partial;
}

const INK = "#111827";
const MUTED = "#6b7280";
const ACCENT = "#3730a3";

/** Rapport individuel: en-tête, synthèse par étape, questions numérotées (pointage à droite + rétroaction choisie), message final. */
function createEvaluationPdfBuffer(evaluation, rubric) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const scores = toPlainObject(evaluation.scores);
    const comments = toPlainObject(evaluation.comments);
    const subScores = toPlainObject(evaluation.subScores);
    const { totalScore, totalMax } = computeTotals(rubric, scores);
    const finalPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const student = latin(evaluation.studentName) || "Non spécifié";
    const firstName = student.split(" ")[0];
    const course = latin(rubric.title) || "Évaluation";
    const exam = latin(rubric.taskTitle);

    const L = doc.page.margins.left;
    const W = doc.page.width - L - doc.page.margins.right;
    const bottom = () => doc.page.height - 56;
    let y = 0;
    const need = (h) => {
      if (y + h > bottom()) {
        doc.addPage();
        y = doc.page.margins.top - 6;
      }
    };
    const text = (str, x, yy, opts, font = "Helvetica", size = 9, color = INK) => {
      doc.font(font).fontSize(size).fillColor(color).text(str, x, yy, opts);
    };
    const heightOf = (str, width, font = "Helvetica", size = 9) => {
      doc.font(font).fontSize(size);
      return doc.heightOfString(str, { width });
    };

    // --- En-tête
    doc.rect(0, 0, doc.page.width, 92).fill(ACCENT);
    text("RAPPORT DE CORRECTION INDIVIDUEL", L, 22, { width: W, characterSpacing: 1 }, "Helvetica-Bold", 8, "#c7d2fe");
    text(course, L, 36, { width: W * 0.7 }, "Helvetica-Bold", 20, "#ffffff");
    if (exam) text(exam, L, 62, { width: W * 0.75 }, "Helvetica", 10, "#e0e7ff");
    y = 112;

    // --- Carte étudiant + note
    const cardH = 74;
    doc.roundedRect(L, y, W, cardH, 6).fillAndStroke("#f8fafc", "#e2e8f0");
    text("ÉTUDIANT", L + 16, y + 12, { width: W * 0.55, characterSpacing: 1 }, "Helvetica-Bold", 7.5, MUTED);
    text(student, L + 16, y + 25, { width: W * 0.55 }, "Helvetica-Bold", 17, INK);
    const dateStr = formatDate(evaluation.date);
    if (dateStr) text(`Évaluation du ${dateStr}`, L + 16, y + 49, { width: W * 0.55 }, "Helvetica", 9, MUTED);
    const colors = feedbackBandColors(finalPct);
    const rx = L + W * 0.58;
    const rw = W * 0.42 - 16;
    text("NOTE FINALE", rx, y + 12, { width: rw, align: "right", characterSpacing: 1 }, "Helvetica-Bold", 7.5, MUTED);
    text(`${NUM(Math.round(totalScore * 10) / 10)} / ${NUM(totalMax)}`, rx, y + 22, { width: rw, align: "right" }, "Helvetica-Bold", 22, ACCENT);
    doc.roundedRect(rx + rw - 150, y + 54, 150, 6, 3).fill("#e2e8f0");
    doc.roundedRect(rx + rw - 150, y + 54, Math.max(4, 150 * Math.min(1, finalPct / 100)), 6, 3).fill(colors.border);
    text(`${Math.round(finalPct)} %`, rx, y + 46, { width: rw - 156, align: "right" }, "Helvetica-Bold", 9, colors.text);
    y += cardH + 18;

    // --- Questions à plat (numérotation continue) + synthèse par bloc
    const sections = [];
    let qn = 0;
    (rubric.criteria || []).forEach((c, i) => {
      const hasTasks = (c.subCriteria || []).length > 0;
      if (!hasTasks && !(Number(c.weight) > 0)) return;
      const cid = criterionKey(c, i);
      const block = getSubBlock(subScores, cid);
      const missedBlock = block[MISSED_KEY] || {};
      const items = [];
      if (hasTasks) {
        c.subCriteria.forEach((sc) => {
          const raw = block[sc.id] ?? block[String(sc.id)];
          const evaluated = raw !== undefined && raw !== null;
          const max = Number(sc.pts) || 0;
          const earned = taskPoints(sc, raw);
          const lvl = evaluated ? pickLevel(sc.levels && sc.levels.length ? sc.levels : c.levels, max ? earned / max : 0) : null;
          items.push({
            n: ++qn,
            group: sc.group || "",
            label: latin(sc.label),
            earned,
            max,
            evaluated,
            level: lvl && lvl.label,
            feedback: evaluated && earned < max ? taskFeedback(sc, missedBlock[sc.id] || missedBlock[String(sc.id)]) : "",
          });
        });
      } else {
        const s = getScore(scores, cid);
        const max = Number(c.weight) || 0;
        const lvl = pickLevel(c.levels, max ? s / max : 0);
        items.push({ n: ++qn, group: "", label: latin(c.title), earned: s, max, evaluated: getNumber(scores, cid) !== undefined, level: lvl && lvl.label, feedback: "" });
      }
      sections.push({ c, cid, items, note: comments[cid] || comments[String(cid)], earned: getScore(scores, cid) });
    });

    const blocks = [];
    sections.forEach((s) => {
      const seen = new Map();
      s.items.forEach((it) => {
        const k = it.group || s.c.title || "Critère";
        const b = seen.get(k) || { name: k, earned: 0, max: 0 };
        b.earned += it.earned;
        b.max += it.max;
        seen.set(k, b);
      });
      blocks.push(...seen.values());
    });
    if (blocks.length > 1) {
      text("SYNTHÈSE PAR ÉTAPE", L, y, { width: W, characterSpacing: 1 }, "Helvetica-Bold", 8, ACCENT);
      y += 16;
      blocks.forEach((b) => {
        need(24);
        const pct = b.max ? b.earned / b.max : 0;
        const nameW = W * 0.5;
        const nh = heightOf(latin(b.name), nameW, "Helvetica", 9);
        text(latin(b.name), L, y, { width: nameW }, "Helvetica", 9, INK);
        doc.roundedRect(L + W * 0.55, y + 3, W * 0.28, 6, 3).fill("#e2e8f0");
        doc.roundedRect(L + W * 0.55, y + 3, Math.max(3, W * 0.28 * pct), 6, 3).fill(STATUS[pct >= 0.999 ? "full" : pct <= 0 ? "none" : "partial"].fg);
        text(`${NUM(b.earned)} / ${NUM(b.max)}`, L + W * 0.85, y, { width: W * 0.15, align: "right" }, "Helvetica-Bold", 9, INK);
        y += Math.max(nh, 12) + 6;
      });
      y += 10;
    }

    // --- Détail question par question
    const numW = 24;
    const ptsW = 84;
    sections.forEach((s) => {
      need(60);
      doc.rect(L, y, W, 24).fill("#eef2ff");
      doc.rect(L, y, 4, 24).fill(criterionStripeColor(s.c));
      text(latin(s.c.title) || "Critère", L + 14, y + 7, { width: W - 120, lineBreak: false }, "Helvetica-Bold", 10, ACCENT);
      text(`${NUM(s.earned)} / ${NUM(Number(s.c.weight) || 0)}`, L + W - 100, y + 7, { width: 90, align: "right" }, "Helvetica-Bold", 10, ACCENT);
      y += 24;
      if (s.c.competencyElement) {
        y += 4;
        const ch = heightOf(`Élément de compétence : ${latin(s.c.competencyElement)}`, W - 14, "Helvetica-Oblique", 8);
        text(`Élément de compétence : ${latin(s.c.competencyElement)}`, L + 14, y, { width: W - 14 }, "Helvetica-Oblique", 8, MUTED);
        y += ch;
      }
      y += 10;

      let lastGroup = null;
      s.items.forEach((it) => {
        if (it.group && it.group !== lastGroup) {
          need(52);
          lastGroup = it.group;
          const gb = blocks.find((b) => b.name === it.group);
          text(latin(it.group), L, y, { width: W - 100 }, "Helvetica-Bold", 10, INK);
          if (gb) text(`${NUM(gb.earned)} / ${NUM(gb.max)} pts`, L + W - 100, y, { width: 100, align: "right" }, "Helvetica-Bold", 9, MUTED);
          const gh = heightOf(latin(it.group), W - 100, "Helvetica-Bold", 10);
          y += gh + 3;
          doc.moveTo(L, y).lineTo(L + W, y).strokeColor("#c7d2fe").lineWidth(0.8).stroke();
          y += 8;
        }
        const st = statusOf(it.evaluated, it.earned, it.max);
        const labelW = W - numW - ptsW - 8;
        const lh = heightOf(it.label, labelW, "Helvetica-Bold", 9.5);
        const fbW = W - numW - 24;
        const fh = it.feedback ? heightOf(it.feedback, fbW - 70, "Helvetica", 8.5) + 12 : 0;
        const blockH = Math.max(lh, 14) + 12 + (fh ? fh + 6 : 0) + 8;
        need(blockH);

        doc.circle(L + 9, y + 8, 9).fill(st.fg);
        text(String(it.n), L, y + 4.5, { width: 18, align: "center", lineBreak: false }, "Helvetica-Bold", 8.5, "#ffffff");
        text(it.label, L + numW, y + 1, { width: labelW }, "Helvetica-Bold", 9.5, INK);
        text(`${NUM(it.earned)} / ${NUM(it.max)}`, L + W - ptsW, y, { width: ptsW, align: "right" }, "Helvetica-Bold", 12, st.fg);
        let yy = y + Math.max(lh, 14) + 3;
        const badge = it.evaluated ? (it.level || st.name) : st.name;
        text(badge, L + numW, yy, { width: labelW, lineBreak: false }, "Helvetica-Bold", 7.5, st.fg);
        yy += 11;
        if (fh) {
          doc.roundedRect(L + numW, yy, W - numW, fh, 3).fill("#fff7ed");
          doc.rect(L + numW, yy, 3, fh).fill("#f97316");
          text("Observation", L + numW + 10, yy + 6, { width: 60, lineBreak: false }, "Helvetica-Bold", 7.5, "#c2410c");
          text(it.feedback, L + numW + 70, yy + 6, { width: fbW - 70 }, "Helvetica", 8.5, "#7c2d12");
          yy += fh;
        }
        y = yy + 10;
        doc.moveTo(L + numW, y - 4).lineTo(L + W, y - 4).strokeColor("#f1f5f9").lineWidth(0.6).stroke();
      });

      if (s.note) {
        const nh = heightOf(latin(s.note), W - 20, "Helvetica-Oblique", 8.5) + 10;
        need(nh + 6);
        text(`Note de l'enseignant : ${latin(s.note)}`, L + 14, y, { width: W - 14 }, "Helvetica-Oblique", 8.5, MUTED);
        y += nh;
      }
      y += 8;
    });

    // --- Synthèse de l'enseignant
    if (evaluation.generalComment) {
      const gc = latin(evaluation.generalComment);
      const h = heightOf(gc, W - 28, "Helvetica", 9.5) + 34;
      need(h + 10);
      doc.roundedRect(L, y, W, h, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      text("COMMENTAIRE DE L'ENSEIGNANT", L + 14, y + 11, { width: W - 28, characterSpacing: 1 }, "Helvetica-Bold", 7.5, MUTED);
      text(gc, L + 14, y + 24, { width: W - 28 }, "Helvetica", 9.5, "#374151");
      y += h + 14;
    }

    // --- Message final, adressé à l'étudiant
    const match = pickFeedbackMessage(rubric, finalPct);
    if (match && match.message) {
      const msg = latin(match.message);
      const h = heightOf(msg, W - 32, "Helvetica", 10) + 40;
      need(h + 10);
      doc.roundedRect(L, y, W, h, 6).fill(colors.bg);
      doc.rect(L, y, 4, h).fill(colors.border);
      text(`MESSAGE POUR ${firstName.toUpperCase()}`, L + 16, y + 11, { width: W - 32, characterSpacing: 1 }, "Helvetica-Bold", 7.5, colors.text);
      text(msg, L + 16, y + 26, { width: W - 32 }, "Helvetica", 10, colors.text);
      y += h + 10;
    }

    // --- Pied de page sur chaque page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - 34;
      doc.moveTo(L, fy - 6).lineTo(L + W, fy - 6).strokeColor("#e2e8f0").lineWidth(0.6).stroke();
      doc.page.margins.bottom = 0;
      text(`${student}  -  ${course}`, L, fy, { width: W - 80, lineBreak: false }, "Helvetica", 7.5, MUTED);
      text(`Page ${i + 1} / ${range.count}`, L + W - 80, fy, { width: 80, align: "right", lineBreak: false }, "Helvetica", 7.5, MUTED);
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
