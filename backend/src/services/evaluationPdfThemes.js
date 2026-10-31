const PDFDocument = require("pdfkit");
const { toPlainObject, criterionKey } = require("../utils/evaluationTotals");
const { helpers: H } = require("./evaluationPdfService");
const { DEFAULTS, fill } = require("../utils/pdfSettings");

const { getScore, getNumber, getSubBlock, taskPoints, computeTotals, pickFeedbackMessage, taskFeedback, pickLevel, latin, formatDate, NUM, openingText, pct1, short, MISSED_KEY, LEVELS_KEY } = H;

/** Trois directions graphiques. `fonts`: titre / texte / chiffres / lettre. */
const THEMES = {
  editorial: {
    label: "Éditorial",
    page: "#FFFFFF", ink: "#0B0B0B", muted: "#6B6B6B", accent: "#E4572E", accent2: "#0B0B0B", line: "#D4D4D4", soft: "#F4F4F2",
    full: "#0B0B0B", partial: "#E4572E", none: "#E4572E", open: "#9CA3AF",
    margin: 56, fonts: { head: "Helvetica-Bold", body: "Helvetica", num: "Courier-Bold", letter: "Times-Roman", letterB: "Times-Bold", letterI: "Times-Italic" },
  },
  studio: {
    label: "Studio",
    page: "#FFFFFF", ink: "#0F172A", muted: "#64748B", accent: "#6D28D9", accent2: "#0EA5A4", line: "#E2E8F0", soft: "#F5F3FF",
    full: "#059669", partial: "#D97706", none: "#DC2626", open: "#94A3B8",
    margin: 40, fonts: { head: "Helvetica-Bold", body: "Helvetica", num: "Helvetica-Bold", letter: "Helvetica", letterB: "Helvetica-Bold", letterI: "Helvetica-Oblique" },
  },
  carnet: {
    label: "Carnet",
    page: "#FCFAF5", ink: "#3B2F2F", muted: "#8A7968", accent: "#C8553D", accent2: "#2F5D50", line: "#E2D4BF", soft: "#F4EEE3",
    full: "#2F5D50", partial: "#B7791F", none: "#C8553D", open: "#A8998A",
    margin: 50, fonts: { head: "Times-Bold", body: "Times-Roman", num: "Times-Bold", letter: "Times-Italic", letterB: "Times-BoldItalic", letterI: "Times-Italic" },
  },
};

const PALETTES = {
  carnet: {},
  ardoise: { page: "#FFFFFF", ink: "#1E293B", muted: "#64748B", accent: "#2B4C7E", accent2: "#1F6F78", line: "#E2E8F0", soft: "#F1F5F9", full: "#1F6F78", partial: "#B7791F", none: "#B91C1C", open: "#94A3B8" },
  bordeaux: { page: "#FFFDFB", ink: "#2B2B2B", muted: "#7A7068", accent: "#8C2F39", accent2: "#3F4A52", line: "#E8DED6", soft: "#F6EEE8", full: "#3F6B4F", partial: "#B7791F", none: "#8C2F39", open: "#A8998A" },
};
const palette = (S, base = THEMES.carnet) => ({ ...base, ...(PALETTES[S.palette] || {}) });
const varsOf = (D, teacherName) => ({ etudiant: D.student, prenom: D.firstName, cours: D.course, examen: D.exam, enseignant: latin(teacherName) });

const keyOf = (evaluated, earned, max) => (!evaluated ? "open" : max > 0 && earned >= max ? "full" : earned <= 0 ? "none" : "partial");

function prepare(evaluation, rubric) {
  const scores = toPlainObject(evaluation.scores);
  const comments = toPlainObject(evaluation.comments);
  const subScores = toPlainObject(evaluation.subScores);
  const { totalScore, totalMax } = computeTotals(rubric, scores);
  const finalPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const student = latin(evaluation.studentName) || "Non spécifié";
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
        const scale = sc.levels && sc.levels.length ? sc.levels : c.levels;
        const chosen = (block[LEVELS_KEY] || {})[sc.id];
        const lvl = evaluated ? (scale || []).find((l) => l.label === chosen) || pickLevel(scale, max ? earned / max : 0) : null;
        items.push({ n: ++qn, group: sc.group || "", label: latin(sc.label), earned, max, evaluated, level: lvl && lvl.label, feedback: evaluated && earned < max ? taskFeedback(sc, missedBlock[sc.id] || missedBlock[String(sc.id)]) : "", insight: evaluated && earned < max ? latin(sc.insight) : "", expected: evaluated && earned < max && sc.levels && sc.levels.length ? latin([...sc.levels].sort((a, b) => b.maxPct - a.maxPct)[0].desc) : "" });
      });
    } else {
      const s = getScore(scores, cid);
      const max = Number(c.weight) || 0;
      const lvl = pickLevel(c.levels, max ? s / max : 0);
      items.push({ n: ++qn, group: "", label: latin(c.title), earned: s, max, evaluated: getNumber(scores, cid) !== undefined, level: lvl && lvl.label, feedback: "", insight: "", expected: "" });
    }
    sections.push({ c, items, note: comments[cid] || comments[String(cid)], earned: getScore(scores, cid) });
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
  const all = sections.flatMap((s) => s.items);
  const lost = all.filter((it) => it.evaluated && it.earned < it.max).sort((a, b) => b.max - b.earned - (a.max - a.earned));
  const done = all.filter((it) => it.evaluated && it.max > 0 && it.earned >= it.max);
  const firstName = student.split(" ")[0];
  return { sections, blocks, all, lost, done, totalScore, totalMax, finalPct, student, firstName, course: latin(rubric.title) || "Évaluation", exam: latin(rubric.taskTitle), opening: openingText(firstName, totalScore, totalMax, finalPct, blocks, lost), match: pickFeedbackMessage(rubric, finalPct), date: formatDate(evaluation.date) };
}

/** Version courte (1 à 2 pages): en-tête, mot d'ouverture, étapes avec toutes les questions sur une ligne, puis « Pour mieux comprendre » et lettre de clôture. */
function createCompactPdfBuffer(evaluation, rubric, { teacherName = "", settings = {} } = {}) {
  const S = { ...DEFAULTS, ...settings };
  const P = palette(S);
  const F = P.fonts;
  const D = prepare(evaluation, rubric);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: S.pageSize, margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const V = varsOf(D, teacherName);
    const L = 46;
    const W = doc.page.width - L * 2;
    const PH = doc.page.height;
    const paint = () => doc.rect(0, 0, doc.page.width, PH).fill(P.page);
    paint();
    doc.on("pageAdded", paint);
    let y = 40;
    const need = (h) => {
      if (y + h > PH - 52) {
        doc.addPage();
        y = 44;
      }
    };
    const T = (str, x, yy, o = {}, font = F.body, size = 9, color = P.ink) => doc.font(font).fontSize(size).fillColor(color).text(str, x, yy, o);
    const HH = (str, w, font = F.body, size = 9, o = {}) => {
      doc.font(font).fontSize(size);
      return doc.heightOfString(str, { width: w, ...o });
    };
    const frac = D.totalMax ? Math.min(1, D.totalScore / D.totalMax) : 0;
    const colorOf = (it) => (!it.evaluated ? P.open : it.earned >= it.max ? P.full : it.earned <= 0 ? P.none : P.partial);

    // --- En-tête
    doc.rect(L, y, W, 1.2).fill(P.ink);
    T(`${latin(fill(S.headerLabel, V)).toUpperCase()}  /  ${D.course.toUpperCase()}`, L, y + 10, { width: W * 0.7, characterSpacing: 1.4, lineBreak: false }, F.body, 7, P.muted);
    const title = D.exam || D.course;
    T(title, L, y + 24, { width: W * 0.66 }, F.head, 18, P.ink);
    const th = HH(title, W * 0.66, F.head, 18);
    T(D.student, L, y + 30 + th, { width: W * 0.66, lineBreak: false }, F.head, 13, P.accent);
    if (S.showDate && D.date) T(D.date, L, y + 47 + th, { lineBreak: false }, F.letterI, 9.5, P.muted);
    const bx = L + W * 0.7;
    const bw = W * 0.3;
    T(NUM(Math.round(D.totalScore * 100) / 100), bx, y + 12, { width: bw, align: "right", lineBreak: false }, F.head, 38, P.accent2);
    T(`sur ${NUM(D.totalMax)}${S.showPercent ? `   -   ${Math.round(D.finalPct)} %` : ""}`, bx, y + 54, { width: bw, align: "right", lineBreak: false }, F.letterI, 10, P.muted);
    doc.rect(bx + bw - 100, y + 70, 100, 3).fill(P.line);
    doc.rect(bx + bw - 100, y + 70, Math.max(3, 100 * frac), 3).fill(P.accent2);
    y += Math.max(th + 66, 84) + 8;
    doc.rect(L, y, W, 0.6).fill(P.line);
    y += 12;

    // --- Mot d'ouverture
    if (S.showOpening) {
      const oh = HH(D.opening, W, F.letter, 11, { lineGap: 2 });
      T(D.opening, L, y, { width: W, lineGap: 2 }, F.letter, 11, P.ink);
      y += oh + 12;
    }

    // --- Étapes + questions sur une ligne
    const numW = 22;
    const ptsW = 64;
    const labelW = W - numW - ptsW - 6;
    D.sections.forEach((s) => {
      if (D.sections.length > 1) {
        need(30);
        T(latin(s.c.title), L, y, { width: W - 90, lineBreak: false }, F.head, 10.5, P.ink);
        T(`${NUM(s.earned)} / ${NUM(Number(s.c.weight) || 0)}`, L + W - 90, y, { width: 90, align: "right", lineBreak: false }, F.head, 10.5, P.accent);
        y += 18;
      }
      let last = null;
      s.items.forEach((it) => {
        if (it.group && it.group !== last) {
          last = it.group;
          const gb = D.blocks.find((b) => b.name === it.group);
          const inGroup = s.items.filter((x) => x.group === it.group);
          const n = inGroup.filter((x) => x.evaluated && x.earned < x.max).length;
          const p = gb ? pct1(gb) : 1;
          const verdict = p >= 0.999 ? "entièrement réussie" : p >= 0.85 ? "bien maîtrisée" : p >= 0.65 ? "en bonne partie réussie" : "à reprendre en grande partie";
          need(60);
          y += 4;
          T(latin(it.group), L, y, { width: W - 90, lineBreak: false, ellipsis: true, height: 14 }, F.letterB, 11.5, P.accent2);
          if (gb) T(`${NUM(gb.earned)} / ${NUM(gb.max)}`, L + W - 90, y + 1, { width: 90, align: "right", lineBreak: false }, F.head, 10, P.ink);
          y += 15;
          doc.rect(L, y, W, 0.6).fill(P.line);
          doc.rect(L, y - 0.6, Math.max(2, W * (gb ? pct1(gb) : 1)), 1.8).fill(P.accent2);
          y += 5;
          if (S.showStepVerdict) {
            T(`${verdict.charAt(0).toUpperCase()}${verdict.slice(1)}${n ? ` - ${n} question${n > 1 ? "s" : ""} à revoir` : ""}.`, L, y, { width: W, lineBreak: false }, F.letterI, 9, P.muted);
            y += 13;
          }
        }
        const lost = it.evaluated && it.earned < it.max;
        if (!lost && !S.listAllQuestions) return;
        const col = colorOf(it);
        need(lost && it.feedback && S.showObservations ? 34 : 15);
        T(`${it.n}.`, L, y + 0.5, { width: numW - 6, lineBreak: false }, F.head, 8.5, lost ? col : P.muted);
        T(it.label, L + numW, y, { width: labelW, height: 11, ellipsis: true }, lost ? F.letterB : F.letter, 9.6, P.ink);
        T(it.evaluated ? `${NUM(it.earned)} / ${NUM(it.max)}` : "non évalué", L + W - ptsW, y, { width: ptsW, align: "right", lineBreak: false }, F.head, 9.5, col);
        y += 12.5;
        if (lost && it.feedback && S.showObservations) {
          const fh = HH(it.feedback, W - numW - 70, F.letterI, 9);
          T(it.feedback, L + numW + 10, y, { width: W - numW - 70 }, F.letterI, 9, P.accent);
          y += fh + 3.5;
        }
        y += 1.5;
      });
      y += 4;
    });

    // --- Pour mieux comprendre (questions les plus coûteuses)
    const explain = D.lost.filter((it) => it.insight).slice(0, 5);
    if (S.showInsights && explain.length) {
      need(60);
      y += 6;
      doc.rect(L, y, W, 1.2).fill(P.ink);
      T("POUR MIEUX COMPRENDRE", L, y + 8, { characterSpacing: 1.6, lineBreak: false }, F.body, 7.5, P.accent);
      y += 24;
      explain.forEach((it) => {
        const head = `${it.n}. ${short(it.label, 88)}`;
        const body = [S.showExpected && it.expected ? `Attendu : ${it.expected}` : "", it.insight].filter(Boolean).join("  ");
        const hh = HH(head, W, F.letterB, 10);
        const bh = HH(body, W - numW, F.letter, 9.6, { lineGap: 1 });
        need(hh + bh + 12);
        T(head, L, y, { width: W }, F.letterB, 10, P.ink);
        T(body, L + numW, y + hh + 1, { width: W - numW, lineGap: 1 }, F.letter, 9.6, P.muted);
        y += hh + bh + 9;
      });
    }

    // --- Lettre de clôture
    const paras = [];
    if (S.showFinalMessage && D.match && D.match.message) paras.push(latin(D.match.message));
    if (S.showPriorityHint && D.lost.length && D.blocks.length > 1) {
      const worst = [...D.blocks].sort((a, b) => pct1(a) - pct1(b))[0];
      if (pct1(worst) < 1) paras.push(`Pour ta prochaine mise en pratique,${S.greeting === "inline" ? ` ${D.firstName},` : ""} commence par « ${latin(worst.name)} » : c'est là que tu peux gagner le plus.`);
    }
    const gc = S.showTeacherComment ? latin(evaluation.generalComment) : "";
    if (gc) paras.push(gc);
    const signature = latin(fill(S.signatureText, V));
    if (paras.length || signature) {
      const total = paras.reduce((h, p) => h + HH(p, W, F.letter, 10.5, { lineGap: 1 }) + 6, 0) + 50;
      need(Math.min(total, 220));
      y += 8;
      doc.rect(L, y, 34, 1.4).fill(P.accent);
      y += 12;
      if (S.greeting === "heading") {
        T(`${D.firstName},`, L, y, { width: W, lineBreak: false }, F.letterB, 12, P.ink);
        y += 17;
      }
      paras.forEach((p) => {
        const ph = HH(p, W, F.letter, 10.5, { lineGap: 1 });
        T(p, L, y, { width: W, lineGap: 1 }, p === gc ? F.letterI : F.letter, 10.5, p === gc ? P.muted : P.ink);
        y += ph + 6;
      });
      y += 4;
      if (signature) T(signature, L, y, { lineBreak: false }, F.letterB, 11.5, P.accent);
    }

    const range = doc.bufferedPageRange();
    const footer = latin(fill(S.footerText, V)) || `${D.student}  /  ${D.course}`;
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      const fy = PH - 30;
      doc.rect(L, fy - 8, W, 0.5).fill(P.line);
      T(footer, L, fy, { width: W - 80, lineBreak: false }, F.letterI, 7.5, P.muted);
      if (S.showPageNumbers) T(`${i + 1} / ${range.count}`, L + W - 80, fy, { width: 80, align: "right", lineBreak: false }, F.letterI, 7.5, P.muted);
    }
    doc.end();
  });
}

function createThemedPdfBuffer(evaluation, rubric, { teacherName = "", theme = "", settings = {} } = {}) {
  const S = { ...DEFAULTS, ...settings };
  const mode = theme || (S.layout === "detaille" ? "carnet" : "compact");
  if (mode === "compact") return createCompactPdfBuffer(evaluation, rubric, { teacherName, settings: S });
  theme = mode;
  const P = theme === "carnet" ? palette(S) : THEMES[theme] || THEMES.carnet;
  const F = P.fonts;
  const D = prepare(evaluation, rubric);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: S.pageSize, margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const V = varsOf(D, teacherName);

    const L = P.margin;
    const W = doc.page.width - L * 2;
    const PH = doc.page.height;
    const paint = () => {
      if (P.page !== "#FFFFFF") doc.rect(0, 0, doc.page.width, PH).fill(P.page);
    };
    paint();
    doc.on("pageAdded", paint);
    let y = 0;
    const bottom = () => PH - 58;
    const need = (h) => {
      if (y + h > bottom()) {
        doc.addPage();
        y = 46;
      }
    };
    const T = (str, x, yy, o = {}, font = F.body, size = 9, color = P.ink) => doc.font(font).fontSize(size).fillColor(color).text(str, x, yy, o);
    const HH = (str, w, font = F.body, size = 9, o = {}) => {
      doc.font(font).fontSize(size);
      return doc.heightOfString(str, { width: w, ...o });
    };
    const ringPath = (cx, cy, r, from, to) => {
      const a0 = from - Math.PI / 2;
      const a1 = to - Math.PI / 2;
      const large = to - from > Math.PI ? 1 : 0;
      return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
    };
    const col = (k) => P[k];
    const frac = D.totalMax ? Math.min(1, D.totalScore / D.totalMax) : 0;
    const scoreStr = NUM(Math.round(D.totalScore * 100) / 100);

    // ============ EN-TÊTE ============
    if (theme === "editorial") {
      doc.rect(L, 40, W, 4).fill(P.ink);
      T("RAPPORT DE CORRECTION", L, 58, { characterSpacing: 2 }, F.head, 7.5, P.muted);
      T(D.course.toUpperCase(), L, 58, { width: W, align: "right", characterSpacing: 2, lineBreak: false }, F.head, 7.5, P.muted);
      T(scoreStr, L - 4, 78, { lineBreak: false }, F.head, 104, P.ink);
      const sw = doc.widthOfString(scoreStr);
      T(`/ ${NUM(D.totalMax)}`, L + sw + 4, 142, { lineBreak: false }, F.body, 26, P.muted);
      const rx = L + W * 0.6;
      T("ÉTUDIANT", rx, 100, { characterSpacing: 2 }, F.head, 7, P.accent);
      T(D.student, rx, 112, { width: W * 0.4 }, F.head, 16, P.ink);
      const nh = HH(D.student, W * 0.4, F.head, 16);
      if (D.exam) T(D.exam, rx, 118 + nh, { width: W * 0.4 }, F.body, 9, P.muted);
      if (D.date) T(D.date, rx, 118 + nh + HH(D.exam || " ", W * 0.4, F.body, 9) + 6, { width: W * 0.4 }, F.body, 8.5, P.muted);
      doc.rect(L, 192, W * Math.max(0.02, frac), 5).fill(P.accent);
      doc.rect(L + W * Math.max(0.02, frac), 194, W * (1 - Math.max(0.02, frac)), 1).fill(P.line);
      T(`${Math.round(D.finalPct)} %`, L, 202, { lineBreak: false }, F.num, 9, P.accent);
      y = 240;
    } else if (theme === "studio") {
      const g = doc.linearGradient(0, 0, doc.page.width, 190);
      g.stop(0, "#312E81").stop(0.55, P.accent).stop(1, P.accent2);
      doc.rect(0, 0, doc.page.width, 196).fill(g);
      doc.save().fillOpacity(0.12).circle(doc.page.width - 40, 30, 110).fill("#FFFFFF").restore();
      doc.save().fillOpacity(0.1).circle(doc.page.width - 150, 190, 70).fill("#FFFFFF").restore();
      doc.save().fillOpacity(0.08).circle(60, 200, 60).fill("#FFFFFF").restore();
      T("RAPPORT DE CORRECTION", L, 34, { characterSpacing: 2 }, F.head, 7.5, "#C7D2FE");
      T(D.course, L, 50, { width: W * 0.62 }, F.head, 21, "#FFFFFF");
      if (D.exam) T(D.exam, L, 50 + HH(D.course, W * 0.62, F.head, 21) + 4, { width: W * 0.62 }, F.body, 9.5, "#E0E7FF");
      T(D.student, L, 128, { width: W * 0.62 }, F.head, 24, "#FFFFFF");
      if (D.date) T(D.date, L, 160, { width: W * 0.6 }, F.body, 9, "#C7D2FE");
      const cx = L + W - 62;
      const cy = 98;
      doc.lineWidth(9).lineCap("round").strokeColor("#FFFFFF").strokeOpacity(0.25).path(ringPath(cx, cy, 46, 0, Math.PI * 1.999)).stroke();
      doc.strokeOpacity(1).lineWidth(9).lineCap("round").strokeColor("#FFFFFF").path(ringPath(cx, cy, 46, 0, Math.max(0.05, frac * Math.PI * 1.999))).stroke();
      T(scoreStr, cx - 40, cy - 17, { width: 80, align: "center", lineBreak: false }, F.head, 25, "#FFFFFF");
      T(`sur ${NUM(D.totalMax)}  -  ${Math.round(D.finalPct)} %`, cx - 50, cy + 12, { width: 100, align: "center", lineBreak: false }, F.body, 7.5, "#E0E7FF");
      y = 222;
    } else {
      doc.rect(L, 40, W, 1.2).fill(P.ink);
      T(latin(fill(S.headerLabel, V)).toUpperCase(), L, 54, { characterSpacing: 2, lineBreak: false }, F.body, 7.5, P.muted);
      T(D.course, L, 72, { width: W * 0.64 }, F.head, 27, P.ink);
      let hy = 72 + HH(D.course, W * 0.64, F.head, 27) + 2;
      if (D.exam) {
        T(D.exam, L, hy, { width: W * 0.64 }, F.letterI, 11.5, P.muted);
        hy += HH(D.exam, W * 0.64, F.letterI, 11.5) + 14;
      }
      doc.rect(L, hy, 28, 1.2).fill(P.accent);
      T("ÉTUDIANT", L, hy + 10, { characterSpacing: 1.5, lineBreak: false }, F.body, 7, P.muted);
      T(D.student, L, hy + 22, { width: W * 0.64 }, F.head, 18, P.ink);
      const nameH = HH(D.student, W * 0.64, F.head, 18);
      if (S.showDate && D.date) T(D.date, L, hy + 26 + nameH, { lineBreak: false }, F.letterI, 10, P.muted);
      const bx = L + W * 0.7;
      const bw = W * 0.3;
      doc.rect(bx - 14, 62, 0.8, 104).fill(P.line);
      T("NOTE FINALE", bx, 66, { width: bw, align: "right", characterSpacing: 1.5, lineBreak: false }, F.body, 7, P.muted);
      T(scoreStr, bx, 80, { width: bw, align: "right", lineBreak: false }, F.head, 44, P.accent2);
      T(`sur ${NUM(D.totalMax)}`, bx, 128, { width: bw, align: "right", lineBreak: false }, F.letterI, 11, P.muted);
      doc.rect(bx + bw - 90, 148, 90, 3).fill(P.line);
      doc.rect(bx + bw - 90, 148, Math.max(3, 90 * frac), 3).fill(P.accent2);
      if (S.showPercent) T(`${Math.round(D.finalPct)} %`, bx, 154, { width: bw, align: "right", lineBreak: false }, F.head, 9.5, P.accent2);
      y = Math.max(hy + nameH + 52, 190);
    }

    // ============ MOT D'OUVERTURE ============
    const opFont = theme === "studio" ? F.body : F.letter;
    const opSize = theme === "studio" ? 10.5 : theme === "carnet" ? 13 : 12.5;
    if (S.showOpening) {
      const oh = HH(D.opening, W, opFont, opSize, { lineGap: 3 });
      need(oh + 20);
      T(D.opening, L, y, { width: W, lineGap: 3 }, opFont, opSize, P.ink);
      y += oh + 22;
    }

    // ============ RÉUSSITES / POINTS À GAGNER ============
    if (S.showHighlights) {
    const colW = (W - 24) / 2;
    const winsLine = D.done.length ? `Questions ${D.done.map((i) => i.n).join(", ")}` : "";
    const lossRows = D.lost.slice(0, 3).map((it) => ({ head: `${it.n}. ${short(it.label, 96)}`, pts: `-${NUM(it.max - it.earned)} pt`, fb: it.feedback }));
    const lossH = lossRows.reduce((h, r) => h + HH(r.head, colW - 74, F.head, 8.5) + (r.fb ? HH(r.fb, colW - 20, F.body, 8) + 2 : 0) + 8, 0);
    const winTitle = `${D.done.length} sur ${D.all.length}`;
    const boxH = Math.max(lossH + 34, 92);
    need(boxH + 16);
    const rx2 = L + colW + 24;
    const paintCol = (x, label, color) => {
      if (theme === "studio") {
        doc.roundedRect(x, y, colW, boxH, 10).fill(color === P.full ? "#ECFDF5" : "#FFF7ED");
        T(label, x + 14, y + 12, { characterSpacing: 1.2, lineBreak: false }, F.head, 7.5, color);
      } else if (theme === "editorial") {
        doc.rect(x, y, colW, 1.5).fill(P.ink);
        T(label, x, y + 8, { characterSpacing: 1.5, lineBreak: false }, F.head, 7.5, color);
      } else {
        doc.rect(x, y, colW, 1.2).fill(color);
        T(label, x, y + 9, { characterSpacing: 1.5, lineBreak: false }, F.body, 7.5, color);
      }
    };
    paintCol(L, "CE QUE TU MAÎTRISES", P.full);
    paintCol(rx2, "OÙ GAGNER DES POINTS", P.partial);
    const px = theme === "studio" ? 14 : 0;
    const topPad = 26;
    T(winTitle, L + px, y + topPad, { lineBreak: false }, theme === "carnet" ? F.head : F.head, theme === "editorial" ? 34 : 24, theme === "studio" ? P.full : P.ink);
    T("questions pleinement réussies", L + px, y + topPad + (theme === "editorial" ? 40 : 30), { width: colW - px * 2, lineBreak: false }, theme === "carnet" ? F.letterI : F.body, 9, P.muted);
    if (winsLine) T(winsLine, L + px, y + topPad + (theme === "editorial" ? 54 : 44), { width: colW - px * 2 }, theme === "carnet" ? F.letterI : F.body, 8.5, P.muted);
    let ly = y + topPad;
    if (!lossRows.length) T("Rien à signaler.", rx2 + px, ly, { lineBreak: false }, F.body, 9, P.muted);
    lossRows.forEach((r) => {
      const hh = HH(r.head, colW - 74, F.head, 8.5);
      T(r.head, rx2 + px, ly, { width: colW - 74 - px }, F.head, 8.5, P.ink);
      T(r.pts, rx2 + colW - 60 - px, ly, { width: 60, align: "right", lineBreak: false }, F.num, 8.5, P.none);
      ly += hh + 1;
      if (r.fb) {
        T(r.fb, rx2 + px, ly, { width: colW - 20 - px }, theme === "carnet" ? F.letterI : F.body, 8, P.muted);
        ly += HH(r.fb, colW - 20 - px, F.body, 8) + 2;
      }
      ly += 6;
    });
    y += boxH + 26;
    }

    // ============ SYNTHÈSE PAR ÉTAPE ============
    if (D.blocks.length > 1) {
      need(70);
      T("SYNTHÈSE PAR ÉTAPE", L, y, { characterSpacing: 1.5, lineBreak: false }, F.head, 7.5, P.accent);
      y += 20;
      if (theme === "studio") {
        const cw = (W - 12) / 2;
        for (let i = 0; i < D.blocks.length; i += 2) {
          need(66);
          [D.blocks[i], D.blocks[i + 1]].forEach((b, k) => {
            if (!b) return;
            const x = L + k * (cw + 12);
            doc.roundedRect(x, y, cw, 56, 9).fill(P.soft);
            T(latin(b.name), x + 12, y + 9, { width: cw - 80, height: 24 }, F.head, 8, P.ink);
            T(`${NUM(b.earned)}`, x + cw - 74, y + 6, { width: 62, align: "right", lineBreak: false }, F.head, 17, P.accent);
            T(`/ ${NUM(b.max)}`, x + cw - 74, y + 26, { width: 62, align: "right", lineBreak: false }, F.body, 8, P.muted);
            doc.roundedRect(x + 12, y + 41, cw - 24, 5, 2.5).fill("#E9E5FB");
            doc.roundedRect(x + 12, y + 41, Math.max(5, (cw - 24) * pct1(b)), 5, 2.5).fill(P.accent);
          });
          y += 66;
        }
      } else {
        D.blocks.forEach((b) => {
          need(26);
          const nameW = W * 0.5;
          const nh = HH(latin(b.name), nameW, theme === "carnet" ? F.body : F.body, theme === "carnet" ? 11 : 9.5);
          T(latin(b.name), L, y, { width: nameW }, F.body, theme === "carnet" ? 11 : 9.5, P.ink);
          doc.rect(L + W * 0.55, y + 5, W * 0.3, 0.8).fill(P.line);
          doc.rect(L + W * 0.55, y + 3.5, Math.max(2, W * 0.3 * pct1(b)), 3.5).fill(theme === "carnet" ? P.accent2 : pct1(b) >= 0.999 ? P.ink : P.accent);
          T(`${NUM(b.earned)} / ${NUM(b.max)}`, L + W * 0.86, y, { width: W * 0.14, align: "right", lineBreak: false }, F.num, theme === "carnet" ? 11 : 9, P.ink);
          y += Math.max(nh, 14) + 7;
        });
      }
      y += 16;
    }

    // ============ DÉTAIL DES QUESTIONS ============
    const numW = theme === "editorial" ? 46 : 34;
    const ptsW = theme === "studio" ? 78 : 90;
    D.sections.forEach((s) => {
      need(130);
      const title = latin(s.c.title) || "Critère";
      if (theme === "editorial") {
        doc.rect(L, y, W, 2).fill(P.ink);
        T(title.toUpperCase(), L, y + 9, { width: W - 90, characterSpacing: 1.2, lineBreak: false }, F.head, 9, P.ink);
        T(`${NUM(s.earned)} / ${NUM(Number(s.c.weight) || 0)}`, L + W - 90, y + 8, { width: 90, align: "right", lineBreak: false }, F.num, 11, P.accent);
        y += 28;
      } else if (theme === "studio") {
        doc.roundedRect(L, y, W, 30, 8).fill(P.ink);
        T(title, L + 16, y + 10, { width: W - 130, lineBreak: false }, F.head, 10.5, "#FFFFFF");
        T(`${NUM(s.earned)} / ${NUM(Number(s.c.weight) || 0)}`, L + W - 100, y + 9, { width: 84, align: "right", lineBreak: false }, F.head, 11, "#A5F3FC");
        y += 40;
      } else {
        T(title, L, y, { width: W - 90, lineBreak: false }, F.head, 15, P.ink);
        T(`${NUM(s.earned)} / ${NUM(Number(s.c.weight) || 0)}`, L + W - 90, y + 1, { width: 90, align: "right", lineBreak: false }, F.head, 14, P.accent);
        doc.moveTo(L, y + 22).lineTo(L + W, y + 22).strokeColor(P.line).lineWidth(0.8).stroke();
        y += 32;
      }
      if (s.c.competencyElement) {
        const ct = `Élément de compétence : ${latin(s.c.competencyElement)}`;
        T(ct, L, y - 4, { width: W }, theme === "carnet" ? F.letterI : F.body, 8, P.muted);
        y += HH(ct, W, F.body, 8) + 8;
      }
      let last = null;
      if (theme === "carnet") {
        const bodyFont = F.letter;
        s.items.forEach((it) => {
          const gb = D.blocks.find((b) => b.name === it.group);
          if (it.group && it.group !== last) {
            last = it.group;
            const gname = latin(it.group);
            const inGroup = s.items.filter((x) => x.group === it.group);
            const toReview = inGroup.filter((x) => x.evaluated && x.earned < x.max).length;
            const p = gb ? pct1(gb) : 1;
            const verdict = p >= 0.999 ? "Étape entièrement réussie." : p >= 0.85 ? "Étape bien maîtrisée; quelques détails ont coûté des points." : p >= 0.65 ? "Étape en bonne partie réussie, avec des éléments à reprendre." : "Cette étape demande une reprise plus complète.";
            const vtxt = p >= 0.999 ? verdict : `${verdict} ${toReview} question${toReview > 1 ? "s" : ""} à revoir.`;
            need(130);
            T(gname, L, y, { width: W - 100 }, F.letterB, 13.5, P.accent2);
            if (gb) T(`${NUM(gb.earned)} / ${NUM(gb.max)}`, L + W - 90, y + 1, { width: 90, align: "right", lineBreak: false }, F.head, 11, P.muted);
            const gh = HH(gname, W - 100, F.letterB, 13.5);
            doc.moveTo(L, y + gh + 3).lineTo(L + W, y + gh + 3).strokeColor(P.line).lineWidth(0.8).stroke();
            y += gh + 10;
            if (S.showStepVerdict) {
              T(vtxt, L, y, { width: W }, F.letterI, 10.5, P.muted);
              y += HH(vtxt, W, F.letterI, 10.5) + 10;
            }
          }
          const k = keyOf(it.evaluated, it.earned, it.max);
          const color = col(k);
          const ptsStr = `${NUM(it.earned)} / ${NUM(it.max)}`;
          const labelW = W - numW - ptsW - 10;
          const lostItem = it.evaluated && it.earned < it.max;
          if (!lostItem && !S.listAllQuestions) return;
          if (!lostItem) {
            const lh = HH(it.label, labelW, bodyFont, 10.5);
            need(lh + 12);
            T(`${it.n}.`, L, y, { width: numW - 8, lineBreak: false }, F.body, 10, P.muted);
            T(it.label, L + numW, y, { width: labelW }, bodyFont, 10.5, P.ink);
            T(it.evaluated ? ptsStr : "non évalué", L + W - ptsW, y, { width: ptsW, align: "right", lineBreak: false }, bodyFont, 10.5, it.evaluated ? P.full : P.muted);
            y += Math.max(lh, 13) + 7;
            return;
          }
          const lh = HH(it.label, labelW, F.letterB, 11.5);
          const pw = W - numW - 14;
          const paras = [
            ["Ce qui était attendu. ", S.showExpected ? it.expected : "", P.accent2],
            ["Ce que j'ai relevé. ", S.showObservations ? it.feedback || "Des points ont été retranchés sur des détails de cette question." : "", P.accent],
            ["Pour comprendre. ", S.showInsights ? it.insight : "", P.muted],
          ].filter((x) => x[1]);
          const heights = paras.map(([lead, txt]) => HH(lead + txt, pw, "Times-Roman", 10.5, { lineGap: 1 }) * 1.03);
          const blockH = Math.max(lh, 16) + 14 + heights.reduce((a, b) => a + b + 6, 0);
          need(Math.min(blockH + 8, 330));
          T(`${it.n}.`, L, y, { width: numW - 8, lineBreak: false }, F.head, 13, color);
          T(it.label, L + numW, y, { width: labelW }, F.letterB, 11.5, P.ink);
          T(ptsStr, L + W - ptsW, y, { width: ptsW, align: "right", lineBreak: false }, F.head, 14, color);
          let yy = y + Math.max(lh, 16) + 2;
          if (it.level) T(it.level, L + numW, yy, { lineBreak: false }, F.letterI, 9, color);
          yy += 14;
          doc.rect(L + numW, yy, 1.4, heights.reduce((a, b) => a + b + 6, 0) - 4).fill(color);
          paras.forEach(([lead, txt, lc], i) => {
            doc.font("Times-BoldItalic").fontSize(10.5).fillColor(lc).text(lead, L + numW + 12, yy, { width: pw, continued: true, lineGap: 1 });
            doc.font("Times-Roman").fontSize(10.5).fillColor(P.ink).text(txt, { width: pw, lineGap: 1 });
            yy += heights[i] + 6;
          });
          y = yy + 8;
        });
      }
      (theme === "carnet" ? [] : s.items).forEach((it) => {
        if (it.group && it.group !== last) {
          need(110);
          last = it.group;
          const gb = D.blocks.find((b) => b.name === it.group);
          const gname = latin(it.group);
          if (theme === "editorial") {
            const m = gname.match(/^(.*?)\s*:\s*(.*)$/);
            if (m) T(m[1].toUpperCase(), L, y, { characterSpacing: 1.5, lineBreak: false }, F.head, 7, P.accent);
            T(m ? m[2] : gname, L, y + (m ? 11 : 0), { width: W - 110 }, F.head, 13, P.ink);
            if (gb) T(`${NUM(gb.earned)}/${NUM(gb.max)}`, L + W - 100, y + (m ? 11 : 0) + 2, { width: 100, align: "right", lineBreak: false }, F.num, 10, P.muted);
            y += (m ? 11 : 0) + HH(m ? m[2] : gname, W - 110, F.head, 13) + 6;
          } else if (theme === "studio") {
            doc.roundedRect(L, y + 1, 8, 8, 2).fill(P.accent2);
            T(gname, L + 16, y - 1, { width: W - 130 }, F.head, 11, P.ink);
            if (gb) {
              doc.roundedRect(L + W - 84, y - 2, 84, 16, 8).fill(P.soft);
              T(`${NUM(gb.earned)} / ${NUM(gb.max)} pts`, L + W - 84, y + 2, { width: 84, align: "center", lineBreak: false }, F.head, 8, P.accent);
            }
            y += Math.max(HH(gname, W - 130, F.head, 11), 14) + 10;
          } else {
            T(gname, L, y, { width: W - 100 }, F.letterB, 13, P.accent2);
            if (gb) T(`${NUM(gb.earned)} / ${NUM(gb.max)}`, L + W - 90, y + 1, { width: 90, align: "right", lineBreak: false }, F.head, 11, P.muted);
            const gh = HH(gname, W - 100, F.letterB, 13);
            doc.moveTo(L, y + gh + 3).lineTo(L + W, y + gh + 3).strokeColor(P.line).lineWidth(0.8).stroke();
            y += gh + 12;
          }
        }
        const k = keyOf(it.evaluated, it.earned, it.max);
        const color = col(k);
        const labelW = W - numW - ptsW - 10;
        const labelFont = theme === "carnet" ? F.letterB : F.head;
        const labelSize = theme === "carnet" ? 11.5 : 9.5;
        const lh = HH(it.label, labelW, labelFont, labelSize);
        const fbW = W - numW - 6;
        const fbFont = theme === "carnet" ? F.letterI : theme === "editorial" ? F.letterI : F.body;
        const fbSize = theme === "editorial" ? 10.5 : theme === "carnet" ? 11 : 8.5;
        const fbPad = theme === "studio" ? 16 : theme === "carnet" ? 18 : 12;
        const fh = it.feedback ? HH(it.feedback, fbW - fbPad - 10, theme === "carnet" ? F.letter : fbFont, theme === "carnet" ? 10.5 : fbSize) + (theme === "editorial" ? 4 : theme === "carnet" ? 26 : 14) : 0;
        const insW = fbW - 22;
        const ih = it.insight ? HH(it.insight, insW, F.letter, 10) + 24 : 0;
        need(Math.max(lh, 18) + 16 + (fh ? fh + 6 : 0) + (ih ? ih + 6 : 0) + 10);

        // numéro
        if (theme === "editorial") T(String(it.n).padStart(2, "0"), L, y - 4, { lineBreak: false }, F.body, 21, k === "full" ? "#BDBDBD" : P.accent);
        else if (theme === "studio") {
          doc.roundedRect(L, y - 1, 22, 22, 6).fill(color);
          T(String(it.n), L, y + 5, { width: 22, align: "center", lineBreak: false }, F.head, 9, "#FFFFFF");
        } else {
          T(`${it.n}.`, L, y, { width: numW - 8, lineBreak: false }, F.head, 13, color);
        }
        T(it.label, L + numW, y, { width: labelW }, labelFont, labelSize, P.ink);
        // pointage à droite
        const ptsStr = `${NUM(it.earned)} / ${NUM(it.max)}`;
        if (theme === "studio") {
          doc.save().fillOpacity(0.13).roundedRect(L + W - ptsW + 8, y - 2, ptsW - 8, 20, 10).fill(color).restore();
          T(ptsStr, L + W - ptsW + 8, y + 3.5, { width: ptsW - 8, align: "center", lineBreak: false }, F.head, 9.5, color);
        } else {
          T(ptsStr, L + W - ptsW, y - (theme === "carnet" ? 1 : 0), { width: ptsW, align: "right", lineBreak: false }, theme === "editorial" ? F.num : F.head, theme === "editorial" ? 12.5 : 14, color);
        }
        let yy = y + Math.max(lh, 16) + 3;
        const badge = it.evaluated ? it.level || "" : "Non évalué";
        if (badge) T(theme === "editorial" ? badge.toUpperCase() : badge, L + numW, yy, { lineBreak: false, characterSpacing: theme === "editorial" ? 1.2 : 0 }, theme === "carnet" ? F.letterI : F.head, theme === "editorial" ? 6.8 : 7.5, color);
        yy += 12;
        if (fh) {
          if (theme === "editorial") {
            doc.rect(L + numW, yy + 1, 1.4, fh - 2).fill(P.accent);
            T(it.feedback, L + numW + 10, yy, { width: fbW - 10 }, fbFont, fbSize, P.accent);
          } else if (theme === "studio") {
            doc.roundedRect(L + numW, yy, fbW, fh, 8).fill(P.soft);
            doc.circle(L + numW + 11, yy + fh / 2, 3).fill(P.accent);
            T(it.feedback, L + numW + 22, yy + 7, { width: fbW - 32 }, fbFont, fbSize, P.ink);
          } else {
            doc.rect(L + numW, yy, fbW, fh).fill(P.soft);
            doc.rect(L + numW, yy, 2, fh).fill(P.accent);
            T("OBSERVATION", L + numW + 12, yy + 6, { characterSpacing: 1.2, lineBreak: false }, F.body, 6.5, P.accent);
            T(it.feedback, L + numW + 12, yy + 16, { width: fbW - 22 }, F.letter, 10.5, P.ink);
          }
          yy += fh;
        }
        if (ih) {
          yy += 6;
          doc.rect(L + numW, yy, 2, ih).fill(P.accent2);
          T("POUR COMPRENDRE", L + numW + 12, yy + 6, { characterSpacing: 1.2, lineBreak: false }, F.body, 6.5, P.accent2);
          T(it.insight, L + numW + 12, yy + 16, { width: insW }, F.letter, 10, P.muted);
          yy += ih;
        }
        y = yy + 12;
        if (theme === "editorial") doc.moveTo(L + numW, y - 6).lineTo(L + W, y - 6).strokeColor(P.line).lineWidth(0.4).stroke();
      });
      if (s.note) {
        const nt = `Note de l'enseignant : ${latin(s.note)}`;
        need(HH(nt, W, F.body, 8.5) + 8);
        T(nt, L, y, { width: W }, F.letterI, 9.5, P.muted);
        y += HH(nt, W, F.letterI, 9.5) + 8;
      }
      y += 10;
    });

    // ============ MOT DE LA FIN ============
    const paras = [];
    if (S.showFinalMessage && D.match && D.match.message) paras.push(latin(D.match.message));
    if (S.showPriorityHint && D.lost.length && D.blocks.length > 1) {
      const worst = [...D.blocks].sort((a, b) => pct1(a) - pct1(b))[0];
      if (pct1(worst) < 1) paras.push(`Pour ta prochaine mise en pratique,${S.greeting === "inline" ? ` ${D.firstName},` : ""} commence par « ${latin(worst.name)} » : c'est là que tu peux gagner le plus.`);
    }
    const gc = S.showTeacherComment ? latin(evaluation.generalComment) : "";
    if (gc) paras.push(gc);
    const signature = latin(fill(S.signatureText, V));
    if (paras.length || signature) {
      const lSize = theme === "studio" ? 10 : 12;
      const inset = theme === "studio" ? 20 : 0;
      const bw = W - inset * 2;
      const total = paras.reduce((h, p) => h + HH(p, bw, F.letter, lSize, { lineGap: 2 }) + 8, 0) + 64 + (theme === "studio" ? 30 : 0);
      need(Math.min(total, 260));
      if (theme === "studio") doc.roundedRect(L, y, W, Math.min(total, 330), 12).fill(P.soft);
      else if (theme === "editorial") doc.rect(L, y, 40, 3).fill(P.accent);
      else doc.rect(L, y, 40, 1.4).fill(P.accent);
      y += theme === "studio" ? 22 : 18;
      if (S.greeting === "heading") {
        T(`${D.firstName},`, L + inset, y, { width: bw }, F.letterB, theme === "studio" ? 12 : 14, theme === "studio" ? P.accent : P.ink);
        y += theme === "studio" ? 20 : 24;
      }
      paras.forEach((p) => {
        const ph = HH(p, bw, p === gc ? F.letterI : F.letter, lSize, { lineGap: 2 });
        need(ph + 8);
        T(p, L + inset, y, { width: bw, lineGap: 2 }, p === gc ? F.letterI : F.letter, lSize, p === gc ? P.muted : P.ink);
        y += ph + 8;
      });
      y += 8;
      if (signature) T(signature, L + inset, y, { width: bw, lineBreak: false }, F.letterB, 12.5, theme === "carnet" ? P.accent : theme === "studio" ? P.accent : P.ink);
      y += 22;
    }

    // ============ PIED DE PAGE ============
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      const fy = PH - 32;
      if (theme === "editorial") doc.rect(L, fy - 8, W, 0.6).fill(P.ink);
      else doc.moveTo(L, fy - 8).lineTo(L + W, fy - 8).strokeColor(P.line).lineWidth(0.6).stroke();
      T(latin(fill(S.footerText, V)) || `${D.student}  /  ${D.course}`, L, fy, { width: W - 80, lineBreak: false, characterSpacing: theme === "editorial" ? 1 : 0 }, theme === "carnet" ? F.letterI : F.body, 7.5, P.muted);
      if (S.showPageNumbers) T(`${i + 1} / ${range.count}`, L + W - 80, fy, { width: 80, align: "right", lineBreak: false }, theme === "carnet" ? F.letterI : F.body, 7.5, P.muted);
    }
    doc.end();
  });
}

module.exports = { createThemedPdfBuffer, THEMES };
