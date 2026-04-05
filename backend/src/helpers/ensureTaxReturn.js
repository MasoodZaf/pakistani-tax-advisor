const prisma = require('../config/prisma');

/**
 * Returns the tax_return id for (userId, taxYear), creating one if needed.
 * Centralised so every form route uses the same logic and column names.
 */
async function ensureTaxReturn(userId, userEmail, taxYear) {
  // Look up the tax_year row first (needed for tax_year_id FK)
  const taxYearRow = await prisma.tax_years.findFirst({
    where: { tax_year: taxYear },
    select: { id: true },
  });

  if (!taxYearRow) {
    throw new Error(`Invalid tax year: ${taxYear}`);
  }

  const existing = await prisma.tax_returns.findFirst({
    where: { user_id: userId, tax_year: taxYear },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.tax_returns.create({
    data: {
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearRow.id,
      tax_year: taxYear,
      return_number: `TR-${userId.substring(0, 8)}-${taxYear}`,
      filing_status: 'draft',
      filing_type: 'normal',
    },
    select: { id: true },
  });

  return created.id;
}

module.exports = ensureTaxReturn;
