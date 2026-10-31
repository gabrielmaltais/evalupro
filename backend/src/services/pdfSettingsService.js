const PdfSettings = require("../models/PdfSettings");
const { DEFAULTS, sanitizePdfSettings } = require("../utils/pdfSettings");

async function getPdfSettings(ownerId) {
  const doc = await PdfSettings.findOne({ owner: ownerId }).lean();
  return sanitizePdfSettings({ ...DEFAULTS, ...(doc ? doc.data : {}) });
}

async function savePdfSettings(ownerId, input) {
  const data = sanitizePdfSettings(input);
  await PdfSettings.findOneAndUpdate({ owner: ownerId }, { data }, { upsert: true, new: true });
  return data;
}

module.exports = { getPdfSettings, savePdfSettings };
