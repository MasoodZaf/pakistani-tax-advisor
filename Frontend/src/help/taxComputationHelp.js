/**
 * Knowledge base for the Tax Computation Summary page.
 *
 * This screen is mostly read-only — every line item is computed from the
 * forms before it. Only ONE field is user-editable: the refund adjustment
 * from prior tax years. We also expose a page-level entry so users can
 * understand what they\'re looking at.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 170, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 */

const taxComputationHelp = {
  page_overview: {
    title: 'About this Tax Computation Summary',
    plainLanguage:
      'This is the FINAL summary of your tax return — every figure here is computed automatically from the forms you filled in earlier (Income, Deductions, Credits, Capital Gains, etc.). Nothing on this page is editable except the "Refund Adjustment" row. To change a number, go back to the originating form and update it there.',
    example:
      'If "Income from Salary" looks wrong, do not try to edit it here — go back to the Normal Income form and fix the salary fields. The summary will recalculate when you return.',
    fbrSection: 'Section 114, Income Tax Ordinance 2001 — Return of Income',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  refund_adjustment: {
    title: 'Refund Adjustment from Prior Year(s)',
    plainLanguage:
      'If FBR owed you a refund from a previous tax year and you opted to ADJUST it against this year\'s demand instead of taking cash, enter that amount here. It reduces what you owe this year. Leave as 0 if you have no prior-year refund or you already received it as a cash refund.',
    example:
      'In tax year 2024 FBR confirmed a Rs 45,000 refund and you ticked "adjust against next year\'s demand" on Form Refund-1. This year you owe Rs 120,000 — enter 45,000 here, and your net demand drops to Rs 75,000.',
    fbrSection: 'Section 170, Income Tax Ordinance 2001 — Refund of Tax',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default taxComputationHelp;
