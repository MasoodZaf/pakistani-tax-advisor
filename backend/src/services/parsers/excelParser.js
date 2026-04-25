'use strict';

/**
 * excelParser.js
 * Parses an uploaded prior-year Excel tax return file and extracts key-value
 * pairs that fieldMapper.js will normalize.
 *
 * Uses the `exceljs` package (already a dep) — the legacy `xlsx` package was
 * dropped due to unpatched CVEs (CVE-2023-30533 prototype pollution,
 * CVE-2024-22363 ReDoS).
 */

const ExcelJS = require('exceljs');

const MAX_KEYS = 20000; // Defensive cap: a malicious workbook with 1M rows
                        // could otherwise flood the resulting object.

/** Extract a primitive from an ExcelJS row-value entry. row.values returns
 *  raw values directly, but they can still be wrappers (formula, rich text,
 *  hyperlink, Date). */
function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return v.result;
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join('');
    }
    if ('text' in v) return v.text;
    return null;
  }
  return v;
}

/**
 * Parse a Buffer containing an .xlsx file.
 * Returns a flat { label: value } map extracted from all sheets.
 *
 * @param {Buffer} buffer — file buffer from multer
 * @returns {Promise<Object>} rawData
 */
async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const rawData = {};
  let totalKeys = 0;

  for (const sheet of workbook.worksheets) {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (totalKeys >= MAX_KEYS) return;

      // ExcelJS row.values is 1-indexed; slice(1) to make it 0-indexed and
      // collect non-empty cells in order.
      const values = (row.values || []).slice(1).map(cellValue);
      const cells = values.filter((v) => v !== null && v !== '');
      if (cells.length < 2) return;

      const label = cells[0];
      const value = cells[1];
      if (label === null || label === undefined) return;

      const key = String(label).trim();
      if (!key) return;

      const numVal = typeof value === 'number'
        ? value
        : parseFloat(String(value).replace(/,/g, ''));
      rawData[key] = Number.isFinite(numVal) ? numVal : String(value).trim();
      totalKeys++;
    });
  }

  return rawData;
}

/**
 * Parse a Buffer containing a JSON file (FBR JSON export format).
 * Returns a flattened key→value map. Keys use underscore-separated path.
 *
 * @param {Buffer} buffer
 * @returns {Object} rawData
 */
function parseJsonBuffer(buffer) {
  const text = buffer.toString('utf-8');
  const parsed = JSON.parse(text);
  const rawData = {};
  let totalKeys = 0;

  function flattenObject(obj, prefix = '') {
    if (totalKeys >= MAX_KEYS) return;
    for (const [k, v] of Object.entries(obj || {})) {
      if (totalKeys >= MAX_KEYS) return;
      const key = prefix ? `${prefix}_${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flattenObject(v, key);
      } else {
        rawData[key] = v;
        totalKeys++;
      }
    }
  }
  flattenObject(parsed);
  return rawData;
}

module.exports = { parseExcelBuffer, parseJsonBuffer };
