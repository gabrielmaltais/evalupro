/** Export CSV compatible Excel (séparateur « ; », BOM UTF-8), protégé contre l'injection de formules. */

function escapeCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return `﻿${rows.map((row) => row.map(escapeCell).join(";")).join("\r\n")}\r\n`;
}

module.exports = { toCsv, escapeCell };
