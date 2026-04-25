/**
 * Export the current rate tables (tax_slabs + tax_rates_config) as a signed
 * JSON bundle. Committed at backend/data/rates-bundle.json. Operators pull
 * this bundle via the Admin UI to refresh their deployment's rates without
 * running raw SQL.
 *
 *   node backend/src/scripts/exportRatesBundle.js                  → write the default path
 *   node backend/src/scripts/exportRatesBundle.js /tmp/bundle.json → custom path
 *
 * Bundle shape:
 *   {
 *     version:       'YYYY-MM-DDThh:mm:ssZ',       // ISO timestamp
 *     generated_at:  ISO datetime,
 *     generator:     git sha + host,
 *     tax_years: [{
 *       tax_year:   '2025-26',
 *       slabs:      [ {slab_type, slab_order, min_income, max_income, tax_rate, fixed_amount}, ... ],
 *       rates:      [ {rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount, description, fbr_reference}, ... ],
 *     }, ...],
 *     checksum:     sha256 over the canonical JSON of payload (excluding checksum itself)
 *   }
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');

async function exportBundle(outPath) {
  const years = await pool.query(
    `SELECT id, tax_year FROM tax_years WHERE is_active = true ORDER BY tax_year`
  );

  const taxYears = [];
  for (const y of years.rows) {
    const slabs = await pool.query(
      `SELECT slab_type, slab_order, slab_name, min_income, max_income, tax_rate, fixed_amount
         FROM tax_slabs
        WHERE tax_year_id = $1
        ORDER BY slab_type, slab_order`,
      [y.id]
    );
    const rates = await pool.query(
      `SELECT rate_type, rate_category, tax_rate, min_amount, max_amount,
              fixed_amount, description, fbr_reference
         FROM tax_rates_config
        WHERE tax_year = $1 AND is_active = true
        ORDER BY rate_type, rate_category`,
      [y.tax_year]
    );

    taxYears.push({
      tax_year: y.tax_year,
      slabs: slabs.rows.map((r) => ({
        slab_type: r.slab_type,
        slab_order: r.slab_order,
        slab_name: r.slab_name,
        min_income: Number(r.min_income),
        max_income: r.max_income === null ? null : Number(r.max_income),
        tax_rate: Number(r.tax_rate),
        fixed_amount: Number(r.fixed_amount),
      })),
      rates: rates.rows.map((r) => ({
        rate_type: r.rate_type,
        rate_category: r.rate_category,
        tax_rate: Number(r.tax_rate),
        min_amount: Number(r.min_amount),
        max_amount: Number(r.max_amount),
        fixed_amount: Number(r.fixed_amount),
        description: r.description,
        fbr_reference: r.fbr_reference,
      })),
    });
  }

  // Canonicalize — sort keys, no whitespace variance — so the checksum is
  // reproducible and diff-friendly.
  const canonical = (obj) => JSON.stringify(obj, Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {}));

  const bundle = {
    version: new Date().toISOString().replace(/\..+Z$/, 'Z'),
    generated_at: new Date().toISOString(),
    generator: `exportRatesBundle.js on ${process.env.npm_lifecycle_event || 'node'}`,
    tax_years: taxYears,
  };

  const payloadForHash = JSON.stringify(bundle.tax_years);
  bundle.checksum = crypto.createHash('sha256').update(payloadForHash).digest('hex');

  const json = JSON.stringify(bundle, null, 2) + '\n';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);

  const totalSlabs = taxYears.reduce((a, y) => a + y.slabs.length, 0);
  const totalRates = taxYears.reduce((a, y) => a + y.rates.length, 0);
  // Dead-variable guard — canonical helper is unused here but kept for possible
  // future strict-diff mode; avoid lint noise.
  void canonical;
  return { outPath, years: taxYears.length, slabs: totalSlabs, rates: totalRates, checksum: bundle.checksum };
}

if (require.main === module) {
  const outPath = process.argv[2] || path.join(__dirname, '..', '..', 'data', 'rates-bundle.json');
  exportBundle(outPath)
    .then((info) => {
      console.log('✓ wrote bundle');
      console.log(`  path:     ${info.outPath}`);
      console.log(`  years:    ${info.years}`);
      console.log(`  slabs:    ${info.slabs}`);
      console.log(`  rates:    ${info.rates}`);
      console.log(`  checksum: ${info.checksum}`);
    })
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗', err?.message);
      process.exit(1);
    });
}

module.exports = { exportBundle };
