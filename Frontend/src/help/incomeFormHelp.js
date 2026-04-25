/**
 * Knowledge base for the Normal Income form.
 *
 * Each entry is plain-language guidance sourced from FBR's published regime —
 * Income Tax Ordinance 2001, Finance Act 2025, and FBR Tax Asaan / FBR
 * e-Filing IRIS published help. Keys match the field's `name` in the form so
 * <HelpHint fieldId="..." /> can pick the right entry.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 12, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 *
 * Stage 2 (later): an "Ask the assistant" button on top of this file content.
 */

const incomeFormHelp = {
  monthly_basic_salary: {
    title: 'Monthly Basic Salary',
    plainLanguage:
      'Enter your basic salary for one month — the figure on your salary slip before any allowances, bonuses, or deductions. We multiply it by 12 to get your annual basic salary.',
    example:
      'If your salary slip shows Basic Pay of Rs. 80,000 per month, enter 80,000 here. The system will calculate the annual basic salary as Rs. 960,000.',
    fbrSection: 'Section 12, Income Tax Ordinance 2001 — Salary',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  monthly_allowances: {
    title: 'Monthly Allowances',
    plainLanguage:
      'All taxable allowances paid every month — house rent, utility, conveyance, special allowance, etc. Do NOT include bonus or medical allowance here; those have their own separate rows below.',
    example:
      'If you get HRA Rs. 20,000 + utility Rs. 5,000 + conveyance Rs. 8,000 every month, enter 33,000 here. The system multiplies by 12 → Rs. 396,000 annually.',
    fbrSection: 'Section 12(2), Income Tax Ordinance 2001 — Perquisites & Allowances',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  bonus: {
    title: 'Bonus',
    plainLanguage:
      'Total annual bonus received during the tax year (1 July – 30 June) — performance bonus, Eid bonus, year-end bonus combined. This is fully taxable as part of your salary.',
    example:
      'If you got an Eid bonus of Rs. 80,000 in May 2025 and a performance bonus of Rs. 200,000 in June 2025, enter 280,000 here.',
    fbrSection: 'Section 12(2)(a), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  medical_allowance: {
    title: 'Medical Allowance',
    plainLanguage:
      'Cash medical allowance paid by your employer — but ONLY enter this if your employer does NOT separately provide free medical treatment or hospitalisation. Up to 10% of basic salary is exempt from tax; we handle that math for you.',
    example:
      'You receive a Rs. 8,000/month medical allowance and your company does NOT cover hospital bills. Annual = Rs. 96,000. Enter that here. If basic salary is Rs. 960,000, then 10% = Rs. 96,000 is exempt — no tax on this amount.',
    fbrSection: 'Clause 139(a), Part I, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  pension_received: {
    title: 'Pension Received from Ex-Employer',
    plainLanguage:
      'Pension you receive monthly from a previous employer (after retirement). Under Finance Act 2025, pension is taxable only on the portion exceeding Rs. 10 million per year — anything below that stays exempt.',
    example:
      'You retired from Habib Bank and receive Rs. 80,000/month pension = Rs. 960,000/year. Enter 960,000. Since this is below Rs. 10M, it remains tax-exempt.',
    fbrSection: 'Section 12 + Clause 8, Part I, Second Schedule (as amended by Finance Act 2025)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  employment_termination_payment: {
    title: 'Employment Termination Payment',
    plainLanguage:
      'A one-time payment received when leaving a job — golden handshake, severance, gratuity from an unapproved fund. Section 12(2)(e)(iii) lets you choose to be taxed at the average rate of the last 3 years instead of your current bracket, which usually means lower tax.',
    example:
      'You received a Rs. 5,000,000 golden handshake. Enter 5,000,000 here. The system applies the 3-year-average treatment automatically when computing your tax.',
    fbrSection: 'Section 12(2)(e)(iii), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  amount_received_on_retirement: {
    title: 'Retirement Receipts (Provident, Pension, Gratuity Funds)',
    plainLanguage:
      'Lump-sum payments received from APPROVED provident, pension, or gratuity funds when you retire. These are fully exempt from tax under Clause 23 of Part I, Second Schedule. Only enter amounts from FBR-approved funds — payments from unapproved funds are taxable and go in the row above.',
    example:
      'You retired and received Rs. 3,500,000 from your company-approved Provident Fund + Rs. 1,200,000 from approved Gratuity Fund. Enter 4,700,000. Result: zero tax on this amount.',
    fbrSection: 'Clauses 22, 23 & 24, Part I, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  directorship_fee: {
    title: 'Directorship Fee u/s 149(3)',
    plainLanguage:
      'Fees received for sitting on a company\'s board of directors — separate from any salary if you also work there. This is taxed at a flat 20% withholding under Section 149(3); the company should already have deducted it before paying you.',
    example:
      'You sit on the board of a listed company and got Rs. 500,000 in directorship fees this year. Enter 500,000. The Rs. 100,000 already withheld (20%) shows up under Adjustable Tax — claim it there.',
    fbrSection: 'Section 149(3), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_cash_benefits: {
    title: 'Other Cash Benefits (LFA, Children Education, etc.)',
    plainLanguage:
      'Any cash benefits not already entered above — Leave Fare Allowance (LFA), children\'s education allowance, club membership reimbursement, etc. If your employer paid you cash in addition to salary, it likely belongs here.',
    example:
      'Employer pays Rs. 50,000 LFA once a year + Rs. 10,000/month for children\'s school = Rs. 50,000 + Rs. 120,000 = Rs. 170,000. Enter 170,000.',
    fbrSection: 'Section 12(2), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  income_exempt_from_tax: {
    title: 'Income Exempt from Tax',
    plainLanguage:
      'Any portion of your salary that is fully exempt under the Second Schedule — e.g. specific allowances paid to government employees, hardship allowance for armed forces, certain foreign-source income for resident teachers/researchers. If you\'re unsure, leave this as zero.',
    example:
      'You\'re a federal government officer posted in a hardship area receiving Rs. 360,000/year hardship allowance specifically exempted. Enter 360,000.',
    fbrSection: 'Part I, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  employer_provident_fund_contribution: {
    title: 'Employer Contribution to Approved Provident Funds',
    plainLanguage:
      'The amount your employer (not you) contributes to an APPROVED provident fund on your behalf. Under Rule 3, Part I, Sixth Schedule, this is taxable to the extent it exceeds 10% of your basic salary OR Rs. 150,000 — whichever is lower.',
    example:
      'Basic salary Rs. 1,200,000. Employer contributes Rs. 144,000 (12%) to your provident fund. 10% threshold = Rs. 120,000, so Rs. 24,000 is taxable. Enter 144,000 — the system applies the threshold.',
    fbrSection: 'Rule 3, Part I, Sixth Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  taxable_value_of_car: {
    title: 'Taxable Value of Company-Provided Car',
    plainLanguage:
      'When your employer gives you a car for personal use, FBR treats a percentage of its cost as a benefit-in-kind: 5% of the car\'s cost if for personal-only, or 10% if for both office and personal use. Enter the cost of the car here — the system applies the percentage.',
    example:
      'Employer provides a Rs. 4,000,000 Toyota Corolla used for both office and personal trips. Enter 4,000,000. The system computes 10% = Rs. 400,000 as the taxable benefit.',
    fbrSection: 'Rule 5, Part III, Sixth Schedule (Valuation of Perquisites)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_taxable_subsidies: {
    title: 'Other Taxable Subsidies & Non-Cash Benefits',
    plainLanguage:
      'Non-cash perks not already covered — free or subsidised housing, domestic servants paid by employer, free utilities at your residence, club memberships, interest-free loans (above Rs. 1M). Enter the fair-market value of these benefits.',
    example:
      'Employer pays Rs. 600,000/year toward your housing rent. Enter 600,000. (If housing is provided directly, the rule is 45% of basic salary, capped at the actual fair rental value.)',
    fbrSection: 'Section 13 + Sixth Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  non_cash_benefit_exempt: {
    title: 'Non-Cash Benefits Exempt from Tax',
    plainLanguage:
      'Specific non-cash benefits that the Ordinance explicitly exempts — e.g. medical treatment provided directly by the employer (not cash), tea/refreshments at the office, free transport for women workers in textile/apparel sector. Most users will leave this as zero.',
    example:
      'Your employer covers all hospital bills for you and your family directly through a panel hospital — Rs. 250,000 spent this year. Enter 250,000.',
    fbrSection: 'Clause 139(b), Part I, Second Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_on_debt_151: {
    title: 'Profit on Debt u/s 151 @ 15%',
    plainLanguage:
      'Profit/markup earned on bank deposits, savings accounts, term deposits, NSS, and Defence Savings Certificates. Withholding @ 15% applies on the full amount when annual profit exceeds Rs. 5 million for filers (higher rates apply for non-filers). Enter the GROSS profit before tax was deducted.',
    example:
      'Your savings account paid you Rs. 6,000,000 profit this year. Enter 6,000,000. Bank already deducted Rs. 900,000 (15%) — claim that under Adjustable Tax.',
    fbrSection: 'Section 151 + Division IIIA, Part I, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  profit_on_debt_151A: {
    title: 'Profit on Debt u/s 151A @ 12.5%',
    plainLanguage:
      'Profit on Sukook (Islamic bonds) — taxed slightly lower than conventional debt at 12.5%. Same Rs. 5M annual threshold as section 151 before withholding kicks in.',
    example:
      'You hold Pakistan Energy Sukook and earned Rs. 5,500,000 profit this year. Enter 5,500,000. Issuer withheld Rs. 687,500 (12.5%) — claim it under Adjustable Tax.',
    fbrSection: 'Section 151A, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  rent_income: {
    title: 'Rent Income (Other Taxable Income)',
    plainLanguage:
      'Annual rent received from immovable property — house, plot, shop, warehouse. Enter the GROSS rent before deducting any expenses. The system handles the standard 1/5 repair allowance (Section 15A) automatically.',
    example:
      'You rented your house in DHA Lahore at Rs. 150,000/month = Rs. 1,800,000/year. Enter 1,800,000. The system deducts the 20% repair allowance + your declared property tax for the taxable amount.',
    fbrSection: 'Section 15 + Section 15A, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_taxable_income_others: {
    title: 'Other Taxable Income — Others',
    plainLanguage:
      'Catch-all for taxable income not covered elsewhere — royalties, freelance/consulting income (not your main job), commission income, agricultural-equipment rental, etc. NOT for capital gains (use the Capital Gains form) or dividends (use Final Tax form).',
    example:
      'You did some freelance design work on the side and earned Rs. 400,000 this year. Enter 400,000.',
    fbrSection: 'Section 39, Income Tax Ordinance 2001 — Income from Other Sources',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default incomeFormHelp;
