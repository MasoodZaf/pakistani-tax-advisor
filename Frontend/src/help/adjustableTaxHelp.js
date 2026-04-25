/**
 * Knowledge base for the Adjustable Tax (withholding) form.
 *
 * Each entry corresponds to a withholding tax category in Pakistan's tax
 * regime — Income Tax Ordinance 2001 + Finance Act 2025. Tax that has already
 * been withheld at source (by your bank, employer, telco, property registrar,
 * etc.) is "adjustable" — it gets credited against your annual tax liability
 * when you file the return.
 *
 * Keys match the field's `key` in fieldGroups (the descriptive snake_case slug
 * used in <HelpHint fieldId="..." />), not the gross/tax DB column names.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 149, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 */

const adjustableTaxHelp = {
  salary_employees_149: {
    title: 'Salary of Employees u/s 149',
    plainLanguage:
      'Tax your employer already deducted from your monthly salary and deposited with FBR. The gross receipt is auto-pulled from your Income form; you only need to enter the tax amount as shown on your salary slip or Form 16/CPR.',
    example:
      'Annual salary Rs. 2,400,000. Employer deducted Rs. 18,000/month = Rs. 216,000 for the year. Enter 216,000 in the tax field. Verify against your Annual Tax Certificate from HR.',
    fbrSection: 'Section 149, Income Tax Ordinance 2001 — Salary',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  directorship_fee_149_3: {
    title: 'Directorship Fee u/s 149(3)',
    plainLanguage:
      'Tax withheld at a flat 20% on fees paid to you for sitting on a company board. The company is required to deduct this before paying you. We auto-calculate at 20% of the gross — edit only if your CPR shows a different amount.',
    example:
      'You sat on the board of Engro Foods and received Rs. 600,000 in director fees. The company withheld Rs. 120,000 (20%) before paying. Tax field auto-fills 120,000.',
    fbrSection: 'Section 149(3), Income Tax Ordinance 2001 — Directorship Fee',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_debt_151_15: {
    title: 'Profit on Debt u/s 151 @ 20%',
    plainLanguage:
      'Withholding tax on bank profit/markup, term deposits, NSS, and bonds. Finance Act 2025 raised the rate from 15% to 20% for individuals. Gross is auto-pulled from your Income form; tax auto-calculates at 20% — edit if your bank certificate (Form-CPR) shows a different amount.',
    example:
      'Your savings account paid Rs. 800,000 profit this year. Bank withheld Rs. 160,000 (20%). The tax field auto-fills 160,000. Cross-check with your Bank Tax Deduction Certificate.',
    fbrSection: 'Section 151, Income Tax Ordinance 2001 (rate raised to 20% by Finance Act 2025)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  profit_debt_sukook_151a: {
    title: 'Profit on Debt — Sukook u/s 151A @ 12.5%',
    plainLanguage:
      'Withholding on profit from Sukook (Islamic bonds) — taxed lower than conventional debt at 12.5%. Gross is auto-fetched from your Income form; tax auto-calculates at 12.5%.',
    example:
      'You hold Pakistan Energy Sukook and earned Rs. 600,000 profit. The issuer withheld Rs. 75,000 (12.5%). Tax auto-fills as 75,000 — verify against the Sukook Profit Payment Certificate.',
    fbrSection: 'Section 151A, Income Tax Ordinance 2001 — Profit on Sukook',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  tax_deducted_rent_section_155: {
    title: 'Tax Deducted on Rent u/s 155',
    plainLanguage:
      'When a company or AOP pays you rent for property, they must withhold tax before paying. For individuals, the rate is generally 15% (slab-based for higher rents). Gross rent is auto-pulled from your Income form; tax auto-calculates at 15% — edit if the tenant deducted at a slab rate.',
    example:
      'You rented your shop in Gulberg to Telenor for Rs. 1,200,000/year. Telenor withheld Rs. 180,000 (15%) and paid you Rs. 1,020,000. Tax auto-fills 180,000. Get the WHT certificate from the tenant.',
    fbrSection: 'Section 155, Income Tax Ordinance 2001 — Income from Property',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  advance_tax_cash_withdrawal_231ab: {
    title: 'Advance Tax on Cash Withdrawal u/s 231AB',
    plainLanguage:
      'When a non-filer withdraws more than Rs. 50,000 cash in a single day from a bank, the bank deducts 0.6% as advance tax. Filers are NOT charged. Enter the amount your bank certificate shows — usually a small figure unless you made big cash withdrawals.',
    example:
      'You are a non-filer who withdrew Rs. 200,000 cash from HBL on 5 days during the year. Bank deducted 0.6% × 5 × 200,000 = Rs. 6,000. Enter Gross 1,000,000 and Tax 6,000.',
    fbrSection: 'Section 231AB, Income Tax Ordinance 2001 — Cash Withdrawal',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  motor_vehicle_registration_fee_231b1: {
    title: 'Motor Vehicle Registration Fee u/s 231B(1)',
    plainLanguage:
      'Advance tax collected when you first register a new vehicle in your name with the Excise Office. The amount depends on engine capacity — small cars pay less, big SUVs pay much more. Enter the figure shown on your registration receipt.',
    example:
      'You bought a new Toyota Corolla 1800cc. At registration, Excise charged Rs. 75,000 advance tax u/s 231B(1). Enter Gross 75,000 and Tax 75,000 (the same — it is the tax itself, not value of car).',
    fbrSection: 'Section 231B(1), Income Tax Ordinance 2001 — Motor Vehicle Registration',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  motor_vehicle_transfer_fee_231b2: {
    title: 'Motor Vehicle Transfer Fee u/s 231B(2) @ 3%',
    plainLanguage:
      'When you transfer a vehicle to or from your name (used car sale/purchase between individuals), Excise collects 3% advance tax of the value. Auto-calculated at 3% — adjust if your receipt shows a different figure.',
    example:
      'You sold your used Honda City for Rs. 3,000,000 to a buyer. At transfer, Excise withheld Rs. 90,000 (3%). Tax auto-fills 90,000.',
    fbrSection: 'Section 231B(2), Income Tax Ordinance 2001 — Motor Vehicle Transfer',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  motor_vehicle_sale_231b3: {
    title: 'Motor Vehicle Sale u/s 231B(3)',
    plainLanguage:
      'Advance tax collected by the manufacturer/dealer on the first sale of a locally manufactured vehicle. The dealer issues a CPR — enter the amount as shown there.',
    example:
      'You bought a new Suzuki Swift directly from the dealer for Rs. 4,200,000. The dealer collected Rs. 50,000 as advance tax u/s 231B(3) on the invoice. Enter Gross 4,200,000 and Tax 50,000.',
    fbrSection: 'Section 231B(3), Income Tax Ordinance 2001 — First Sale of Motor Vehicle',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  motor_vehicle_leasing_231b1a: {
    title: 'Motor Vehicle Leasing u/s 231B(1A) @ 4% (Non-ATL)',
    plainLanguage:
      'Tax withheld by leasing company / bank when a non-filer leases a vehicle. Filers (ATL) are exempt. Auto-calculated at 4% of the lease value.',
    example:
      'You are a non-filer and leased a Hyundai Tucson for Rs. 6,000,000 from MCB Leasing. They withheld Rs. 240,000 (4%). Tax auto-fills 240,000.',
    fbrSection: 'Section 231B(1A), Income Tax Ordinance 2001 — Motor Vehicle Leasing',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  advance_tax_motor_vehicle_231b2a: {
    title: 'Advance Tax on Motor Vehicle u/s 231B(2A)',
    plainLanguage:
      'Annual advance tax collected on motor vehicle ownership — generally collected with token tax / annual fitness. Amount varies by engine capacity. Enter the figure shown on your token-tax receipt.',
    example:
      'Your 2000cc Honda Civic annual token tax challan included Rs. 25,000 as 231B(2A) advance tax. Enter Gross 25,000 and Tax 25,000.',
    fbrSection: 'Section 231B(2A), Income Tax Ordinance 2001 — Annual Motor Vehicle Advance Tax',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  electricity_bill_domestic_235: {
    title: 'Electricity Bill — Domestic u/s 235 @ 7.5%',
    plainLanguage:
      'Tax withheld on your domestic electricity bill above a monthly threshold. The discos (K-Electric, LESCO, IESCO, etc.) print this on your bill. Enter the TOTAL ANNUAL bill amount (gross) and the TOTAL TAX deducted across all 12 months. We auto-calculate at 7.5% — edit if actual is different.',
    example:
      'Your annual electricity bills (LESCO) totalled Rs. 480,000 with Rs. 36,000 income tax deducted across the year. Enter Gross 480,000 and Tax 36,000. Sum the "Income Tax" line from each monthly bill.',
    fbrSection: 'Section 235, Income Tax Ordinance 2001 — Electricity Consumption',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  telephone_bill_236_1e: {
    title: 'Telephone Bill u/s 236(1)(a) @ 15%',
    plainLanguage:
      'Tax deducted on landline telephone bills. PTCL prints this on each bill. Add up your annual landline bills and tax for entry here.',
    example:
      'Your PTCL landline bills totalled Rs. 24,000 with Rs. 3,600 (15%) tax deducted across 12 months. Enter Gross 24,000 and Tax 3,600.',
    fbrSection: 'Section 236(1)(a), Income Tax Ordinance 2001 — Telephone Subscriber',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  cellphone_bill_236_1f: {
    title: 'Cellphone Bill u/s 236(1)(a) @ 15%',
    plainLanguage:
      'Tax deducted on postpaid cellphone bills (Jazz, Zong, Telenor, Ufone). Add the income-tax line from all 12 monthly bills. Filers can claim this back; non-filers cannot.',
    example:
      'Your Jazz postpaid bills totalled Rs. 60,000 with Rs. 9,000 (15%) advance tax across the year. Enter Gross 60,000 and Tax 9,000.',
    fbrSection: 'Section 236(1)(a), Income Tax Ordinance 2001 — Cellular Mobile Subscriber',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  prepaid_telephone_card_236_1b: {
    title: 'Prepaid Telephone Card u/s 236(1)(b) @ 15%',
    plainLanguage:
      'Tax deducted on prepaid recharge cards / easy-load. This is harder to track since most users don\'t keep receipts — only enter if you have evidence (e.g. corporate prepaid card statement).',
    example:
      'You used a corporate prepaid card and the telco issued an annual statement showing Rs. 40,000 spent and Rs. 6,000 (15%) tax. Enter Gross 40,000 and Tax 6,000. Skip if you have no records.',
    fbrSection: 'Section 236(1)(b), Income Tax Ordinance 2001 — Prepaid Telephone Cards',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  phone_unit_236_1c: {
    title: 'Phone Unit u/s 236(1)(c) @ 15%',
    plainLanguage:
      'Tax deducted on the sale of phone units / call minutes. Like prepaid cards, only claim if you have actual documentation from the operator. Most retail users will leave this as zero.',
    example:
      'A corporate operator issued you a usage statement showing Rs. 20,000 phone unit purchases and Rs. 3,000 tax. Enter Gross 20,000 and Tax 3,000.',
    fbrSection: 'Section 236(1)(c), Income Tax Ordinance 2001 — Sale of Units',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  internet_bill_236_1d: {
    title: 'Internet Bill u/s 236(1)(d) @ 15%',
    plainLanguage:
      'Tax deducted on home or office broadband bills (StormFiber, Nayatel, PTCL Flash Fiber, etc.). The bill itself shows the income-tax line. Add 12 months of tax for the annual figure.',
    example:
      'Your StormFiber bill is Rs. 6,000/month → Rs. 72,000/year, with Rs. 900/month tax deducted = Rs. 10,800 annual. Enter Gross 72,000 and Tax 10,800.',
    fbrSection: 'Section 236(1)(d), Income Tax Ordinance 2001 — Internet Subscriber',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  prepaid_internet_card_236_1e: {
    title: 'Prepaid Internet Card u/s 236(1)(e) @ 15%',
    plainLanguage:
      'Tax deducted on prepaid mobile data/internet packages. Like prepaid telephone cards, only enter if you have documentary evidence — usually a corporate statement.',
    example:
      'A telco issued you an annual statement showing Rs. 30,000 of prepaid internet bundles with Rs. 4,500 tax. Enter Gross 30,000 and Tax 4,500.',
    fbrSection: 'Section 236(1)(e), Income Tax Ordinance 2001 — Prepaid Internet Cards',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  sale_transfer_immoveable_property_236c: {
    title: 'Sale / Transfer of Immovable Property u/s 236C',
    plainLanguage:
      'Advance tax collected by the property registrar (sub-registrar/society/DHA) when you SELL or transfer property. Filers pay 3% of the FBR value, non-filers pay much higher. Enter the gross value and the tax shown on your transfer challan.',
    example:
      'You sold a 10-marla house in DHA Lahore at Rs. 30,000,000 (FBR value Rs. 25,000,000). As filer, registrar collected 3% × 25,000,000 = Rs. 750,000. Enter Gross 25,000,000 and Tax 750,000.',
    fbrSection: 'Section 236C, Income Tax Ordinance 2001 — Sale/Transfer of Immovable Property',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  tax_deducted_236c_property_purchased_sold_same_year: {
    title: '236C — Property Bought & Sold Within Same Tax Year',
    plainLanguage:
      'Special line for when you purchased a property and resold it within the same tax year (1 July – 30 June). Tax paid on this short-hold transaction is reported separately.',
    example:
      'You bought a plot in Bahria Town in Aug 2025 for Rs. 8,000,000 and sold it in May 2026 for Rs. 9,500,000. Enter Gross 9,500,000 (sale value) and the 236C tax actually deducted at sale.',
    fbrSection: 'Section 236C, Income Tax Ordinance 2001 — Same-Year Property Resale',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  tax_deducted_236c_property_purchased_prior_year: {
    title: '236C — Property Purchased Prior to Current Tax Year',
    plainLanguage:
      'Use this row if the property was BOUGHT in a previous tax year but SOLD in the current year. Most property sales fall in this category.',
    example:
      'You bought a house in 2018 and sold it in March 2026 for Rs. 18,000,000. As filer, registrar collected 3% × FBR value = Rs. 450,000. Enter Gross 15,000,000 (FBR value) and Tax 450,000.',
    fbrSection: 'Section 236C, Income Tax Ordinance 2001 — Sale of Pre-existing Property',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  purchase_transfer_immoveable_property_236k: {
    title: 'Purchase / Transfer of Immovable Property u/s 236K',
    plainLanguage:
      'Advance tax collected by the registrar when you BUY property. Filers pay 3% of FBR value (post-Finance Act 2025), non-filers pay sharply higher. Enter the gross value and the tax shown on your purchase challan.',
    example:
      'You purchased a 5-marla plot in Lake City Lahore for Rs. 12,000,000 (FBR value Rs. 10,000,000). As filer, the registrar collected 3% × 10,000,000 = Rs. 300,000. Enter Gross 10,000,000 and Tax 300,000.',
    fbrSection: 'Section 236K, Income Tax Ordinance 2001 — Purchase of Immovable Property',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  functions_gatherings_charges_236cb: {
    title: 'Functions / Gatherings Charges u/s 236CB',
    plainLanguage:
      'Tax withheld by marriage halls, hotels, banquet venues, restaurants on functions / events. Rate is 10% for filers (ATL) and 20% for non-filers. Pick your status — tax auto-calculates accordingly.',
    example:
      'You held your daughter\'s wedding at Pearl Continental Lahore. Total bill Rs. 4,000,000. As ATL filer, hotel withheld 10% = Rs. 400,000. Select ATL, enter Gross 4,000,000, tax auto-fills 400,000.',
    fbrSection: 'Section 236CB, Income Tax Ordinance 2001 — Functions and Gatherings',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  functions_gatherings_charges_236cb_atl_status: {
    title: 'ATL Status for Functions u/s 236CB',
    plainLanguage:
      'Choose your filer status as on the date of the function. ATL (on the Active Taxpayer List) gets 10%, Non-ATL pays 20%. Most regular filers select ATL.',
    example:
      'You filed your 2024 return on time and your name is on FBR\'s ATL. You are ATL — pick that. If you became filer only mid-year, check the FBR ATL for the function date.',
    fbrSection: 'Section 236CB read with Tenth Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  withholding_tax_sale_considerations_37e: {
    title: 'WHT on Sale Considerations u/s 37(6)',
    plainLanguage:
      'Tax withheld on the value of shares transferred between unlisted companies / private placements at 10% of share value. This applies to specific share-transfer scenarios — consult your broker / company secretary if unsure.',
    example:
      'You sold Rs. 5,000,000 worth of unlisted company shares. The transferee company withheld Rs. 500,000 (10%). Enter Gross 5,000,000 and Tax 500,000.',
    fbrSection: 'Section 37(6), Income Tax Ordinance 2001 — Capital Gains on Securities',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  advance_fund_23a_part_i_second_schedule: {
    title: 'Advance Tax on Pension Fund Withdrawal u/c 23A',
    plainLanguage:
      'Tax withheld by your Voluntary Pension Scheme (VPS) provider when you withdraw money before the prescribed retirement age. Withdrawing early triggers this advance tax. Enter the amount as shown on the VPS withdrawal certificate.',
    example:
      'You withdrew Rs. 2,000,000 from your VPS account at age 50 (before retirement). The VPS deducted Rs. 100,000 (5%). Enter Gross 2,000,000 and Tax 100,000.',
    fbrSection: 'Clause 23A, Part I, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  persons_remitting_amount_abroad_236v: {
    title: 'Foreign Remittance via Cards u/s 236Y',
    plainLanguage:
      'Tax collected by your bank when you remit money abroad using a credit/debit/prepaid card — typically a 5% advance tax on the remitted amount. The bank statement shows it as "withholding tax".',
    example:
      'You spent Rs. 800,000 on international card transactions during the year (foreign trips, online shopping). Bank withheld Rs. 40,000 (5%). Enter Gross 800,000 and Tax 40,000.',
    fbrSection: 'Section 236Y, Income Tax Ordinance 2001 — Foreign Remittance via Cards',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  advance_tax_foreign_domestic_workers_231c: {
    title: 'Advance Tax on Foreign Domestic Workers u/s 231C',
    plainLanguage:
      'Annual advance tax collected by NADRA / Ministry of Interior when you hire a foreign domestic worker (e.g. household help from Philippines, Sri Lanka). Enter the figure shown on the work-permit challan.',
    example:
      'You employed a Filipino nanny and paid Rs. 200,000 work-permit fee, of which Rs. 100,000 was 231C advance tax. Enter Gross 200,000 and Tax 100,000.',
    fbrSection: 'Section 231C, Income Tax Ordinance 2001 — Foreign Domestic Workers',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default adjustableTaxHelp;
