/**
 * Knowledge base for the Tax Credits form.
 *
 * Each entry is plain-language guidance sourced from FBR's published regime —
 * Income Tax Ordinance 2001 (Sections 61, 62, 63 — donations, investments,
 * pension fund contributions) and Finance Act 2025. Keys match the `item.id`
 * (or field name) used in CreditsForm.
 *
 * Authoring rules (same as incomeFormHelp.js):
 *   - plainLanguage: 1-3 sentences in plain Pakistani-English. No legalese.
 *   - example: a concrete Pakistani PKR scenario.
 *   - fbrSection: legal anchor.
 *   - fbrUrl: where the user can verify.
 */

const creditsHelp = {
  charitable_donations_u61: {
    title: 'Charitable Donations u/s 61',
    plainLanguage:
      'Donations to FBR-approved non-profit organisations (Edhi, Shaukat Khanum, SIUT, TCF, registered NPOs on FBR\'s list) get a tax credit at your average tax rate. Eligible donation is capped at 30% of your taxable income — anything above the cap is ignored. Keep the donation receipt and confirm the NPO is approved before claiming.',
    example:
      'Taxable income Rs. 4,000,000, normal tax Rs. 600,000 → average rate 15%. You donated Rs. 800,000 to Shaukat Khanum. Cap = 30% × 4,000,000 = Rs. 1,200,000 (your donation is below the cap, so fully eligible). Credit = 800,000 × 15% = Rs. 120,000 off your tax.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001 — Charitable Donations',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  charitable_donations_associate: {
    title: 'Donations Made to an Associate',
    plainLanguage:
      'If your donation is to an "associate" (e.g. an NPO controlled by you, your family, or a related company), the cap drops sharply to 15% of taxable income — to prevent abuse. Same average-rate credit, just a tighter ceiling.',
    example:
      'Taxable income Rs. 4,000,000. You donated Rs. 700,000 to a trust where your spouse is on the board. Cap = 15% × 4,000,000 = Rs. 600,000 — only that much is eligible. Credit = 600,000 × 15% (avg rate) = Rs. 90,000.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001 — Donations to Associates (15% cap)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  pension_fund_u63: {
    title: 'Approved Pension Fund Contribution u/s 63',
    plainLanguage:
      'Personal contributions to a Voluntary Pension Scheme (VPS) approved by SECP — e.g. UBL VPS, Meezan Tahaffuz Pension Fund. You get a tax credit at average rate on the contribution, capped at 20% of your taxable income. (Late joiners aged 41+ may use a higher cap of up to 30% — 2% extra per year over age 40.)',
    example:
      'You\'re 35, taxable income Rs. 3,000,000, normal tax Rs. 360,000 → average rate 12%. You contributed Rs. 500,000 to JS Pension Savings Fund. Cap = 20% × 3,000,000 = Rs. 600,000 (your contribution is below cap, fully eligible). Credit = 500,000 × 12% = Rs. 60,000.',
    fbrSection: 'Section 63, Income Tax Ordinance 2001 — Contribution to Approved Pension Fund',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  surrender_tax_credit_investments: {
    title: 'Surrender of Earlier Investment Tax Credit',
    plainLanguage:
      'A REVERSAL entry — if you previously claimed a tax credit on shares (under the now-repealed Section 62) and you sold those shares before completing the minimum holding period (24 months), you must surrender that credit back. Enter the credit amount being reversed as a positive number; the system treats it as a reduction to your total credits.',
    example:
      'In tax year 2022 you claimed Rs. 40,000 credit on listed-share investment. In 2025 you sold those shares before 24 months were complete. You must surrender that Rs. 40,000 — enter 40,000 here.',
    fbrSection: 'Section 62 (now omitted) read with general clawback principles, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  // ── Sub-field help (Y/N, amount, taxReduction inputs) ─────────────────────
  charitable_donations_amount: {
    title: 'Donation Amount (u/s 61)',
    plainLanguage:
      'Total amount donated this year to FBR-approved non-profits. Enter the gross donation; the system applies the 30%-of-taxable-income cap and computes the credit at your average rate.',
    example:
      'You donated Rs. 50,000 to Edhi Foundation, Rs. 200,000 to TCF, and Rs. 150,000 to Shaukat Khanum across the year. Total = Rs. 400,000. Enter 400,000.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  charitable_donations_tax_credit: {
    title: 'Tax Credit on Donations',
    plainLanguage:
      'The actual tax credit amount — auto-calculated as eligible donation × your average tax rate. Editable if you need to override (e.g. partial year filer with a manual computation).',
    example:
      'Eligible donation Rs. 400,000, average rate 15% → credit Rs. 60,000. Appears here automatically.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  charitable_donations_associate_amount: {
    title: 'Donation Amount (To Associate)',
    plainLanguage:
      'Donation made to a non-profit that qualifies as your "associate" — same field rules as above but with a tighter 15% of taxable income cap.',
    example:
      'You donated Rs. 250,000 to a trust controlled by your family. Enter 250,000.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  charitable_donations_associate_tax_credit: {
    title: 'Tax Credit on Associate Donations',
    plainLanguage:
      'Auto-calculated credit on the associate-restricted donation — eligible amount (capped at 15% of taxable income) × average tax rate.',
    example:
      'Donation Rs. 250,000, taxable income Rs. 4,000,000, cap Rs. 600,000 → fully eligible. Avg rate 15% → credit Rs. 37,500. Appears here.',
    fbrSection: 'Section 61, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  pension_fund_amount: {
    title: 'Pension Fund Contribution Amount',
    plainLanguage:
      'Total amount you (not your employer) contributed this tax year to an SECP-approved Voluntary Pension Scheme. Get a contribution receipt from the AMC for your records.',
    example:
      'You contributed Rs. 30,000/month to Meezan Tahaffuz Pension Fund × 12 = Rs. 360,000 for the year. Enter 360,000.',
    fbrSection: 'Section 63, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  pension_fund_tax_credit: {
    title: 'Tax Credit on Pension Contribution',
    plainLanguage:
      'Auto-calculated credit on your VPS contribution — eligible amount (capped at 20% of taxable income, higher cap if 41+) × average tax rate.',
    example:
      'Contribution Rs. 360,000, taxable income Rs. 3,000,000, cap = 20% × 3M = Rs. 600,000 → fully eligible. Avg rate 12% → credit Rs. 43,200. Appears here.',
    fbrSection: 'Section 63, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  surrender_tax_credit_amount: {
    title: 'Surrender Amount (Reversal)',
    plainLanguage:
      'Disclosure of the share investment whose tax credit you\'re surrendering — typically the cost amount of those shares. Optional informational field.',
    example:
      'You sold shares originally bought for Rs. 600,000 before completing 24 months. Enter 600,000 to disclose the underlying investment being unwound.',
    fbrSection: 'Section 62 (omitted) — clawback rule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  surrender_tax_credit_reduction: {
    title: 'Credit Being Surrendered',
    plainLanguage:
      'The actual tax credit amount you previously claimed and are now giving back. Enter as a positive number — the system treats it as a reduction to your total credits this year.',
    example:
      'You claimed Rs. 40,000 credit in tax year 2022 on shares you\'ve now sold early. Enter 40,000 here.',
    fbrSection: 'Section 62 (omitted) — clawback rule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default creditsHelp;
