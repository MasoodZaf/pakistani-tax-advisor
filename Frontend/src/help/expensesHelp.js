/**
 * Knowledge base for the Allowable Expenses form (used for Wealth Statement
 * reconciliation under Section 116 of the Income Tax Ordinance 2001).
 *
 * These are NOT tax-deductible expenses — they are your annual living/personal
 * outflows declared so FBR can reconcile your closing wealth against your
 * opening wealth + income. Mismatches trigger questions about unexplained
 * income, so accuracy matters.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 116, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 */

const expensesHelp = {
  rent: {
    title: 'Rent Paid',
    plainLanguage:
      'Total rent you paid this year for your residence — house, apartment, or portion. Enter the annual amount, NOT the monthly figure. Do not include rent paid for business premises here (that goes in business expenses elsewhere).',
    example:
      'You rent a 10-marla house in Lahore at Rs 75,000/month = Rs 900,000/year. Enter 900,000. If you own your home, enter 0.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement (Personal Expenses)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  rates_taxes_charges: {
    title: 'Property Rates, Taxes & Charges',
    plainLanguage:
      'Annual property tax paid to the provincial Excise & Taxation department, urban immovable property tax, water/sewerage charges (if billed by the municipality), and society maintenance dues. Only what YOU actually paid out-of-pocket.',
    example:
      'Property tax bill Rs 18,000 + DHA society maintenance Rs 24,000/year + WASA charges Rs 6,000 = Rs 48,000. Enter 48,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  maintenance: {
    title: 'Property Maintenance',
    plainLanguage:
      'Repairs, painting, plumbing, electrical work, generator servicing, and any household upkeep done at your residence this year. Do NOT include capital improvements (e.g. building a new room) — those go on the wealth statement as additions to property value.',
    example:
      'You repainted the house (Rs 80,000), fixed the AC compressor (Rs 25,000), and did monthly society cleaning (Rs 12,000). Total = Rs 117,000. Enter 117,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  electricity: {
    title: 'Electricity Bills',
    plainLanguage:
      'Total amount paid for electricity at your residence over the full tax year (1 July - 30 June). Add up all 12 LESCO/IESCO/K-Electric/etc. bills. Use the gross amount you paid including taxes/duties — that\'s what came out of your bank/wallet.',
    example:
      'Average summer bills Rs 35,000/month (May-Sep) + winter bills Rs 12,000/month (Oct-Apr) ≈ Rs 259,000/year. Enter 259,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  water: {
    title: 'Water Bills',
    plainLanguage:
      'WASA water bills or borewell/tanker water expenses for your residence over the year. If your water is part of society maintenance (already entered above), leave this as 0 to avoid double-counting.',
    example:
      'You buy 2 water tankers per month at Rs 2,500 each = Rs 60,000/year. Enter 60,000. If water is included in DHA maintenance, enter 0.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  gas: {
    title: 'Gas Bills',
    plainLanguage:
      'SNGPL/SSGC gas bills for the year, or LPG cylinder costs if you don\'t have a gas connection. Sum all 12 months\' actual paid amounts.',
    example:
      'Winter gas bills average Rs 8,000/month (Nov-Feb) + summer Rs 1,500/month (Mar-Oct) = Rs 44,000/year. Enter 44,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  telephone: {
    title: 'Telephone & Internet',
    plainLanguage:
      'PTCL/landline + mobile phone bills + home internet (Nayatel/Stormfiber/PTCL etc.) for the year. Include all family members\' connections paid by you. Mobile prepaid top-ups also count — sum your easyload/JazzCash recharge history.',
    example:
      'Home fibre Rs 4,500/month + 2 mobile postpaid lines Rs 3,000/month + occasional prepaid Rs 1,500/month ≈ Rs 108,000/year. Enter 108,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  vehicle_running_maintenance: {
    title: 'Vehicle Running & Maintenance',
    plainLanguage:
      'Annual fuel (petrol/diesel/CNG), routine servicing, repairs, oil changes, tyres, and motor insurance for your personal vehicles. Do NOT include the cost of buying a new car here — that goes as a wealth-statement addition.',
    example:
      'Petrol Rs 25,000/month + service Rs 30,000/year + insurance Rs 80,000/year = Rs 410,000. Enter 410,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  travelling: {
    title: 'Travel Expenses',
    plainLanguage:
      'Personal travel — domestic flights, international holidays, hotels, Uber/Careem/inDrive rides, train tickets, etc. EXCLUDES official travel reimbursed by your employer. Include Umrah/Hajj travel here if self-funded.',
    example:
      'Family Umrah trip Rs 1,200,000 + 2 domestic flights Rs 60,000 + Careem rides Rs 80,000 = Rs 1,340,000. Enter 1,340,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  medical: {
    title: 'Medical Expenses',
    plainLanguage:
      'Hospital bills, doctor consultations, medicines, lab tests, dental, optical — for you and your dependents. EXCLUDE anything reimbursed by employer-provided medical insurance or panel hospital coverage (only what you paid net of reimbursement).',
    example:
      'Doctor visits Rs 25,000 + medicines Rs 60,000 + one surgery Rs 350,000 (Rs 200,000 reimbursed by insurance, you paid Rs 150,000 net) = Rs 235,000. Enter 235,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  educational: {
    title: 'Educational Expenses',
    plainLanguage:
      'Tuition fees, admission fees, school van, uniforms, books, stationery, tutor charges — for your children/dependents. This is purely for wealth-reconciliation. The Section 60D tax DEDUCTION (separate, capped at Rs 60k/child) lives on the Deductions form.',
    example:
      'Two children at Beaconhouse: tuition Rs 480,000 + van Rs 96,000 + books/uniforms Rs 60,000 = Rs 636,000. Enter 636,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  entertainment: {
    title: 'Entertainment',
    plainLanguage:
      'Eating out, cinema, streaming subscriptions (Netflix/YouTube Premium), club memberships, family events, gifts, and any social/leisure spending. Be reasonable — under-reporting here causes wealth-statement mismatches.',
    example:
      'Restaurants Rs 15,000/month + Netflix Rs 1,200/month + family wedding gifts Rs 100,000 = Rs 294,400. Round to 295,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  income_tax: {
    title: 'Income Tax Paid (this year)',
    plainLanguage:
      'TOTAL income tax you actually paid out-of-pocket this year — withholding tax deducted by employer/banks, advance tax under Section 147, and any tax paid with prior return. This shows on your wealth statement as money that left your accounts.',
    example:
      'Salary tax deducted Rs 240,000 + bank withholding on profit Rs 45,000 + advance tax on car token Rs 12,000 = Rs 297,000. Enter 297,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  donations_zakat_annuity: {
    title: 'Charitable Donations, Zakat & Annuity',
    plainLanguage:
      'Personal Zakat, charity to mosques, Edhi, SKMCH, schools, etc., plus any annuity/insurance premium payments. This is the WEALTH-STATEMENT line — separate from any tax-deduction Zakat which is captured on the Deductions form. Enter the total cash actually given.',
    example:
      'Personal Zakat to mosque Rs 50,000 + SKMCH donation Rs 100,000 + life insurance premium Rs 80,000 = Rs 230,000. Enter 230,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_expenses: {
    title: 'Other Expenses',
    plainLanguage:
      'Any household outflows not captured above — domestic staff salaries (driver, cook, maid, guard), groceries, clothing, household consumables, dry-cleaning, salon visits, etc. The wealth statement must reconcile, so be honest about everyday spending.',
    example:
      'Driver Rs 35,000/month + maid Rs 18,000/month + groceries Rs 60,000/month + clothing Rs 200,000/year = Rs 1,556,000. Enter 1,556,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default expensesHelp;
