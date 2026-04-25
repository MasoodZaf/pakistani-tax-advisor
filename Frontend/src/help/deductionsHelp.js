/**
 * Knowledge base for the Deductible Allowance form.
 *
 * Each entry is plain-language guidance sourced from FBR's published regime —
 * Income Tax Ordinance 2001 (Sections 60, 60C, 60D) and Finance Act 2025.
 * Keys match the field's `name` (or row id) so <HelpHint fieldId="..." />
 * can pick the right entry.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 60, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 */

const deductionsHelp = {
  professional_expenses: {
    title: 'Professional Expenses (POS) u/s 60C',
    plainLanguage:
      'A deduction for shopkeepers and professionals who pay through Point-of-Sale (POS) machines integrated with FBR. ONLY available if your taxable income is Rs 1.5 million or less. The system caps the deduction at the LOWER of 5% of your POS payments or 25% of your taxable income.',
    example:
      'You run a small clinic, taxable income Rs 1,200,000, and you paid Rs 800,000 through a POS-integrated machine. 5% of POS = Rs 40,000; 25% of income = Rs 300,000. Your deduction = Rs 40,000 (the lower).',
    fbrSection: 'Section 60C, Income Tax Ordinance 2001 — Deductible Allowance for Profit on Debt / Professional Expenses',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  professional_expenses_yn: {
    title: 'Claim Professional Expenses Deduction?',
    plainLanguage:
      'Choose Y if you want to claim the POS-payment deduction under Section 60C. Choose N if you do not pay through a POS-integrated machine or your taxable income exceeds Rs 1.5 million.',
    example:
      'You are a salaried employee with no POS payments — select N. You are a shopkeeper with FBR-registered POS and taxable income Rs 1.4M — select Y.',
    fbrSection: 'Section 60C, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  professional_expenses_pos_amount: {
    title: 'Total POS Payments (for auto-calculation)',
    plainLanguage:
      'Enter the TOTAL amount you paid this year through your FBR-integrated POS machine — fee collections, sales, etc. The system multiplies this by 5% and compares it to 25% of your taxable income; the LOWER number becomes your deduction.',
    example:
      'You collected Rs 1,000,000 through your POS this year. Enter 1,000,000. The system computes 5% = Rs 50,000 as the POS-side cap.',
    fbrSection: 'Section 60C, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  zakat_paid_ordinance: {
    title: 'Zakat Paid under the Zakat & Usher Ordinance',
    plainLanguage:
      'Zakat that was COMPULSORILY deducted from your bank account on 1st of Ramadan under the Zakat and Usher Ordinance, 1980 — or paid directly to a recognised Zakat fund. This is a STRAIGHT deduction from your taxable income (no caps, no percentage limits).',
    example:
      'On 1st Ramadan your bank deducted Rs 35,000 Zakat from your savings account. Enter 35,000 — the full amount comes off your taxable income.',
    fbrSection: 'Section 60, Income Tax Ordinance 2001 — Zakat',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  zakat_paid_ordinance_yn: {
    title: 'Claim Zakat Deduction?',
    plainLanguage:
      'Choose Y if Zakat was deducted from your bank/savings under the Zakat & Usher Ordinance, or you paid Zakat to an FBR-recognised Zakat fund. Personal Zakat given directly to individuals or unregistered organisations does NOT qualify here.',
    example:
      'Your bank deducted Rs 28,000 Zakat at the start of Ramadan — you have the certificate. Select Y.',
    fbrSection: 'Section 60, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  zakat_paid_amount: {
    title: 'Zakat Amount Paid',
    plainLanguage:
      'Enter the total Zakat amount you paid this tax year that qualifies under Section 60 — typically the bank-deducted Zakat shown on your Zakat Deduction Certificate (Form CZ-50). Keep the certificate as proof for your records.',
    example:
      'Your bank deducted Rs 42,000 from your savings account on 1st Ramadan. Enter 42,000.',
    fbrSection: 'Section 60, Income Tax Ordinance 2001 — Zakat',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  education_expense: {
    title: 'Education Expense Deduction u/s 60D',
    plainLanguage:
      'A deduction for tuition fees paid for your children, ONLY available if your taxable income is Rs 1.5 million or less. Capped at Rs 60,000 per child for a maximum of 2 children — i.e. up to Rs 120,000 per family. The system computes this for you from the number of children.',
    example:
      'You earn Rs 1,200,000/year and pay tuition for 2 children. Deduction = Rs 60,000 × 2 = Rs 120,000. The system fills the amount automatically once you enter "2" for number of children.',
    fbrSection: 'Section 60D, Income Tax Ordinance 2001 — Deductible Allowance for Educational Expenses',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  education_expense_yn: {
    title: 'Claim Education Deduction?',
    plainLanguage:
      'Choose Y if your taxable income is Rs 1.5M or less AND you paid tuition fees for your children at a recognised educational institution this year. Choose N otherwise — the field is auto-disabled when income exceeds the threshold.',
    example:
      'Annual taxable income Rs 1,300,000, 1 child in school — select Y. Annual taxable income Rs 2,500,000 — not eligible, leave as N or blank.',
    fbrSection: 'Section 60D, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  education_expense_children_count: {
    title: 'Number of Children (for tuition deduction)',
    plainLanguage:
      'How many of your children received tuition for which you paid fees this year? Maximum 2 children counted by FBR — entering a higher number is automatically capped. Each counted child gives you Rs 60,000 of deduction.',
    example:
      'You have 3 school-going children but FBR only allows 2 — enter 2. Result: Rs 60,000 × 2 = Rs 120,000 deduction.',
    fbrSection: 'Section 60D, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default deductionsHelp;
