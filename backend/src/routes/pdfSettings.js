const express = require("express");
const { auth } = require("../middleware/auth");
const { DEFAULTS, sanitizePdfSettings } = require("../utils/pdfSettings");
const { getPdfSettings, savePdfSettings } = require("../services/pdfSettingsService");
const { createThemedPdfBuffer } = require("../services/evaluationPdfThemes");
const { sampleEvaluation } = require("../services/pdfSampleData");

const router = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
  try {
    res.json({ settings: await getPdfSettings(req.user._id), defaults: DEFAULTS });
  } catch (error) {
    res.status(400).json({ message: "Lecture des réglages impossible", details: error.message });
  }
});

router.put("/", async (req, res) => {
  try {
    res.json({ settings: await savePdfSettings(req.user._id, req.body) });
  } catch (error) {
    res.status(400).json({ message: "Enregistrement des réglages impossible", details: error.message });
  }
});

// Aperçu avec les réglages en cours d'édition (sans les enregistrer).
router.post("/preview", async (req, res) => {
  try {
    const { evaluation, rubric } = sampleEvaluation();
    const buffer = await createThemedPdfBuffer(evaluation, rubric, { teacherName: req.user.name, settings: sanitizePdfSettings(req.body) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="apercu.pdf"');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(400).json({ message: "Aperçu impossible", details: error.message });
  }
});

module.exports = router;
