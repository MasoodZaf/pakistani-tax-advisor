/**
 * Knowledge base for the Tax Reductions form.
 *
 * Each entry is plain-language guidance sourced from FBR's published regime —
 * Income Tax Ordinance 2001 (full-time teacher reduction, Behbood/Pensioner's
 * Benefit Account cap, clause 9A property gain reductions for armed forces /
 * govt employees) and Finance Act 2025. Keys match the field name (or item.id)
 * used in ReductionsForm.
 *
 * Authoring rules (same as incomeFormHelp.js):
 *   - plainLanguage: 1-3 sentences in plain Pakistani-English. No legalese.
 *   - example: a concrete Pakistani PKR scenario.
 *   - fbrSection: legal anchor.
 *   - fbrUrl: where the user can verify.
 */

const reductionsHelp = {
  teacher_researcher_reduction: {
    title: 'Tax Reduction for Full-Time Teacher / Researcher',
    plainLanguage:
      'If you are a full-time teacher or researcher at a recognised non-profit education or research institution, your tax on salary income is reduced by 25%. Pick "Y" and the system pulls your salary tax from the Final/Min Income form and applies the 25% cut automatically. Doctors who teach but earn from private medical practice are NOT eligible.',
    example:
      'You are a full-time professor at LUMS earning Rs. 3,000,000 salary. Your tax on salary works out to Rs. 320,000. The system applies the 25% reduction = Rs. 80,000 off your tax bill, so you actually pay Rs. 240,000.',
    fbrSection: 'Clause (2), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  behbood_certificates_reduction: {
    title: 'Behbood / Pensioner\'s Benefit Account Tax Cap',
    plainLanguage:
      'Profit on Behbood Saving Certificates and Pensioner\'s Benefit Account is capped — the tax on this profit cannot exceed the rate prescribed (5%). Enter the profit amount you received; the system computes the maximum tax allowed so the excess over 5% is reduced.',
    example:
      'You are a retired senior citizen and earned Rs. 600,000 profit on Behbood Certificates this year. Tax cap = 5% × 600,000 = Rs. 30,000 maximum. If your normal-slab tax on this profit would have been Rs. 90,000, the reduction is Rs. 60,000 (90,000 − 30,000).',
    fbrSection: 'Clause (6), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_immovable_reduction: {
    title: 'CGT Reduction @ 50% — Armed Forces / Govt Personnel',
    plainLanguage:
      'Ex-servicemen and serving personnel of the Armed Forces, plus ex-employees and serving personnel of the Federal & Provincial Governments, get a 50% reduction in tax on capital gain from immovable property allotted to them. Only enter this if you fall in one of those categories AND the property was an allotment.',
    example:
      'You are a retired Major and sold a DHA plot allotted to you. CGT computed at normal rates = Rs. 400,000. Enter Rs. 200,000 (50% of 400,000) here as the tax reduction. The other 50% remains payable.',
    fbrSection: 'Clause (9A), Part II, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_clause9a_reduction: {
    title: 'CGT Reduction @ 75% — Armed Forces / Govt Personnel (Part III)',
    plainLanguage:
      'Higher 75% reduction in tax on capital gain from immovable property for the same Armed Forces / Govt categories where the property qualifies under Part III, Second Schedule clause (9A). Stricter eligibility — typically war wounded, shaheed families, or specific allotments.',
    example:
      'You are the widow of a shaheed officer and sold an allotted plot. CGT at normal rate would be Rs. 600,000. The clause grants 75% reduction = Rs. 450,000 off. Enter 450,000 here.',
    fbrSection: 'Clause (9A), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  // Sub-field help for the Y/N, amount, and tax-reduction inputs of each item.
  // Keyed by exact field-name used in the form.
  teacher_researcher_reduction_yn: {
    title: 'Are You a Full-Time Teacher / Researcher?',
    plainLanguage:
      'Pick "Y" if you teach or do research full-time at a recognised non-profit education or research institute (universities, HEC-recognised colleges, govt research bodies). The 25% reduction kicks in automatically when you select Y.',
    example:
      'Full-time professor at NUST → choose Y. Visiting lecturer also doing private practice → choose N (the reduction does not apply if you have private medical practice income).',
    fbrSection: 'Clause (2), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  teacher_researcher_amount: {
    title: 'Salary Income Subject to Reduction',
    plainLanguage:
      'Optional disclosure field — the salary amount on which the 25% reduction is being calculated. The system actually pulls salary tax automatically from your Final/Min Income form, so you can leave this blank. Only fill it if you want to record the underlying salary explicitly.',
    example:
      'Your annual salary is Rs. 3,000,000. You can enter 3,000,000 here for transparency, but the reduction is calculated from the salary tax (not the salary amount itself).',
    fbrSection: 'Clause (2), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  teacher_researcher_tax_reduction: {
    title: 'Tax Reduction Amount (25% Auto)',
    plainLanguage:
      'The 25% reduction in your salary tax. Auto-calculated when you select "Y" in the Y/N column — system pulls your salary tax from the Final/Min Income form and multiplies by 25%. You can override the figure if you have a special case.',
    example:
      'Salary tax computed = Rs. 320,000. Auto-reduction = 25% × 320,000 = Rs. 80,000 — appears here automatically.',
    fbrSection: 'Clause (2), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  behbood_certificates_reduction_yn: {
    title: 'Do You Hold Behbood Certificates / Pensioner\'s Benefit Account?',
    plainLanguage:
      'Pick "Y" if you earned profit on Behbood Saving Certificates or a Pensioner\'s Benefit Account this year. These are National Savings products limited to widows, senior citizens, and pensioners.',
    example:
      'You\'re 65 and have Rs. 5,000,000 invested in Behbood Certificates that paid Rs. 600,000 profit this year → choose Y.',
    fbrSection: 'Clause (6), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  behbood_certificates_amount: {
    title: 'Profit Amount Earned on Behbood / PBA',
    plainLanguage:
      'Total profit (markup) credited to you on Behbood Certificates and Pensioner\'s Benefit Account during the tax year. The system uses this to calculate the 5% tax cap and the resulting reduction.',
    example:
      'Your CDNS profile shows Rs. 600,000 profit credited from Behbood Certificates between 1 July 2024 and 30 June 2025. Enter 600,000.',
    fbrSection: 'Clause (6), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  behbood_certificates_tax_reduction: {
    title: 'Behbood Reduction Amount',
    plainLanguage:
      'The tax reduction so that the effective tax on Behbood profit does not exceed 5%. Auto-suggested when you enter the profit amount. Editable if you need to override.',
    example:
      'Profit Rs. 600,000. Cap @ 5% = Rs. 30,000 max tax. If normal-slab tax on this profit was Rs. 90,000, the reduction = Rs. 60,000 — appears here.',
    fbrSection: 'Clause (6), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_immovable_reduction_yn: {
    title: 'Are You Eligible for Clause (9A) Part II — 50% Reduction?',
    plainLanguage:
      'Pick "Y" only if you are an ex-serviceman, serving member of the Armed Forces, or ex/serving employee of Federal/Provincial Government AND you sold an immovable property allotted to you in that capacity.',
    example:
      'Retired Lt. Colonel selling a DHA plot allotted by the Cantonment Board → choose Y. Civilian selling a DHA plot bought from open market → choose N.',
    fbrSection: 'Clause (9A), Part II, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_immovable_amount: {
    title: 'Capital Gain Amount (Eligible Property)',
    plainLanguage:
      'The capital gain amount on the eligible allotted property — same gain you reported on the Capital Gains form. The 50% reduction is computed on the tax (not the gain itself).',
    example:
      'You sold an allotted plot for Rs. 12,000,000 against cost Rs. 8,000,000 → gain Rs. 4,000,000. Enter 4,000,000.',
    fbrSection: 'Clause (9A), Part II, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_immovable_tax_reduction: {
    title: 'Tax Reduction Amount (50%)',
    plainLanguage:
      'Enter 50% of the normal CGT computed on the eligible gain. This is the reduction that comes off your tax bill. You can verify the CGT figure on the Capital Gains form.',
    example:
      'CGT on the eligible Rs. 4,000,000 gain at the applicable slab = Rs. 400,000. Enter Rs. 200,000 (50% of 400,000) here.',
    fbrSection: 'Clause (9A), Part II, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_clause9a_reduction_yn: {
    title: 'Eligible for Clause (9A) Part III — 75% Reduction?',
    plainLanguage:
      'Higher 75% reduction. Stricter eligibility — typically applies to war wounded, shaheed families, or specific allotment categories under Part III. If unsure, leave as N or check with your Cantonment Board / employer.',
    example:
      'Widow/heir of a shaheed officer selling an allotted plot → likely Y, subject to confirmation. General serving officer → use the 50% Part II row instead.',
    fbrSection: 'Clause (9A), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_clause9a_amount: {
    title: 'Capital Gain Amount (Part III Eligible)',
    plainLanguage:
      'Capital gain on the eligible property under Part III, Second Schedule clause (9A). Same figure as on your Capital Gains form for that property.',
    example:
      'Allotted plot sold; gain Rs. 6,000,000 → enter 6,000,000.',
    fbrSection: 'Clause (9A), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_clause9a_tax_reduction: {
    title: 'Tax Reduction Amount (75%)',
    plainLanguage:
      'Enter 75% of the normal CGT on the eligible gain. This is the reduction to your tax bill.',
    example:
      'CGT on Rs. 6,000,000 gain at normal slab = Rs. 600,000. Reduction @ 75% = Rs. 450,000 — enter that here.',
    fbrSection: 'Clause (9A), Part III, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default reductionsHelp;
