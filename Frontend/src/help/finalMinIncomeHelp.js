/**
 * Knowledge base for the Income Subject to Final / Minimum Tax form.
 *
 * This form covers income types that are taxed at fixed rates and are NOT
 * added to your normal income for slab computation — dividend, sukook profit,
 * prize winnings, bonus shares, etc. References Income Tax Ordinance 2001 +
 * Finance Act 2025 rates.
 *
 * Keys here match the `amountField` in FIELD_DEFINITIONS for the row, so the
 * help is anchored on the row's main amount input. The form has 3 columns
 * (Amount, Tax Deducted, Tax Chargeable) — one help entry per row covers all
 * three columns since they share context.
 */

const finalMinIncomeHelp = {
  salary_u_s_12_7: {
    title: 'Salary u/s 12(7)',
    plainLanguage:
      'Your full annual salary (auto-pulled from the Income form). Tax Deducted is auto-calculated using the FBR 2025-26 slab rates — edit if your employer\'s actual deduction differs. Tax Chargeable is what you ENTER MANUALLY based on your Annual Salary Tax Certificate.',
    example:
      'Annual salary Rs. 2,400,000. Slab tax computed = Rs. 165,000 (FBR 2025-26 slabs). Your salary slip shows your employer actually deducted Rs. 162,000. Enter 162,000 in Tax Chargeable.',
    fbrSection: 'Section 12(7), Income Tax Ordinance 2001 — Salary',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  dividend_u_s_150_0pc_share_profit_reit_spv_amount: {
    title: 'Dividend u/s 150 @ 0% (REIT SPV)',
    plainLanguage:
      'Dividend received from a Real Estate Investment Trust (REIT) or Special Purpose Vehicle (SPV) where profit passes through to CPPAG. Taxed at 0% — but you must still report the income.',
    example:
      'You received Rs. 250,000 dividend from Dolmen REIT. Enter Amount 250,000. Tax fields stay 0 — but reporting it builds your wealth-statement reconciliation.',
    fbrSection: 'Section 150 + Clause 11A, Part IV, Second Schedule (REIT exemption)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  dividend_u_s_150_35pc_share_profit_other_spv_amount: {
    title: 'Dividend u/s 150 @ 35% (Other SPV)',
    plainLanguage:
      'Dividend from non-REIT SPVs — usually biomass / bagasse-based power projects. ATL filers pay 35%, non-filers pay 70%. Tax is auto-calculated based on the gross dividend.',
    example:
      'You received Rs. 400,000 dividend from a bagasse-based power SPV. As ATL filer, tax = 35% × 400,000 = Rs. 140,000. Enter Amount 400,000 — tax fields auto-fill.',
    fbrSection: 'Section 150 + Division III, Part I, First Schedule (FA 2025)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  dividend_u_s_150_7_5pc_ipp_shares_amount: {
    title: 'Dividend u/s 150 @ 7.5% (IPP Shares)',
    plainLanguage:
      'Dividend from shares of Independent Power Producers (IPPs) like Hub Power, K-Electric. Concessional rate of 7.5% for ATL filers, 15% for non-filers.',
    example:
      'You hold Hub Power shares and received Rs. 600,000 dividend this year. As ATL filer, tax = 7.5% × 600,000 = Rs. 45,000. Enter Amount 600,000 — tax auto-fills.',
    fbrSection: 'Section 150 + Clause (a), Division III, Part I, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  dividend_u_s_150_31pc_atl_amount: {
    title: 'Dividend u/s 150 @ 15% (Standard / Mutual Funds < 50% Debt)',
    plainLanguage:
      'Dividend from regular listed companies, OR from mutual funds whose profit-on-debt component is LESS than 50%. Standard rate: 15% for ATL, 30% for non-ATL.',
    example:
      'You received Rs. 200,000 dividend from MCB Bank shares. As filer, tax = 15% × 200,000 = Rs. 30,000. Enter Amount 200,000 — tax auto-fills 30,000.',
    fbrSection: 'Section 150 + Division III, Part I, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  dividend_u_s_150_25pc_bf_losses_amount: {
    title: 'Dividend u/s 150 @ 25% (BF Loss Cos / Mutual Funds ≥ 50% Debt)',
    plainLanguage:
      'Higher 25% rate applies to dividends from companies with brought-forward losses (paying no tax themselves) OR mutual funds with 50%+ profit-on-debt component. ATL pays 25%, non-ATL pays 50%.',
    example:
      'You hold units of NIT Income Fund (60% profit-on-debt). Annual dividend Rs. 300,000. As ATL filer, tax = 25% × 300,000 = Rs. 75,000. Enter Amount 300,000.',
    fbrSection: 'Section 150 + Clause (b), Division III, Part I, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  return_on_investment_sukuk_u_s_151_1a_25pc_amount: {
    title: 'Sukook Return u/s 151(1A) @ 25% (Above Rs. 5M)',
    plainLanguage:
      'Profit on Sukook investment EXCEEDING Rs. 5 million in the year — minimum tax of 25% for individual investors. Tax auto-calculates at 25%.',
    example:
      'You earned Rs. 7,000,000 profit on WAPDA Sukook this year. Tax = 25% × 7,000,000 = Rs. 1,750,000. Enter Amount 7,000,000.',
    fbrSection: 'Section 151(1A), Income Tax Ordinance 2001 — Sukook Profit',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  return_invest_exceed_1m_sukuk_saa_12_5pc_amount: {
    title: 'Sukook Return u/s 151(1A) @ 12.5% (Rs. 1M – Rs. 5M)',
    plainLanguage:
      'Profit on Sukook between Rs. 1,000,000 and Rs. 5,000,000 — final tax at 12.5%. Auto-calculated.',
    example:
      'You earned Rs. 3,000,000 profit on Pakistan Energy Sukook this year. Tax = 12.5% × 3,000,000 = Rs. 375,000. Enter Amount 3,000,000.',
    fbrSection: 'Section 151(1A), Income Tax Ordinance 2001 — Sukook Profit (mid-tier)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  return_invest_not_exceed_1m_sukuk_saa_10pc_amount: {
    title: 'Sukook Return u/s 151(1A) @ 10% (Up to Rs. 1M)',
    plainLanguage:
      'Profit on Sukook up to Rs. 1,000,000 — concessional final tax at 10%. Most retail Sukook investors fall here. Auto-calculated.',
    example:
      'You earned Rs. 600,000 profit on Bank Islami Sukook this year. Tax = 10% × 600,000 = Rs. 60,000. Enter Amount 600,000.',
    fbrSection: 'Section 151(1A), Income Tax Ordinance 2001 — Sukook Profit (concessional)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount: {
    title: 'Profit on Debt via FCVA / SCRA @ 10%',
    plainLanguage:
      'Profit on debt instruments held through Foreign Currency Value Account (FCVA) or Special Convertible Rupee Account (SCRA) — 10% for ATL filers, 20% for non-filers. Generally for non-residents or resident Pakistanis with declared foreign accounts.',
    example:
      'You are a non-resident Pakistani holding government bonds via SCRA. Annual profit Rs. 500,000. Tax = 10% × 500,000 = Rs. 50,000. Enter Amount 500,000.',
    fbrSection: 'Clauses 5(A) / 5AA / 5AB, Part II, Second Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_debt_national_savings_defence_39_14a_amount: {
    title: 'Profit on NSS / Defence Savings — Variable Rate',
    plainLanguage:
      'Profit on National Savings Certificates (Behbood, Pensioners\' Benefit, Regular Income, etc.) and Defence Savings Certificates. The applicable rate depends on the year of investment and certificate type — enter Tax Chargeable MANUALLY.',
    example:
      'You earned Rs. 800,000 profit on Behbood Savings Certificates. The applicable rate at issuance was 5%. Enter Amount 800,000 and Tax Chargeable 40,000 (manually).',
    fbrSection: 'Section 39(4A), Income Tax Ordinance 2001 — Profit on National Savings',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  interest_income_profit_debt_7b_up_to_5m_amount: {
    title: 'Profit on Bank Deposits u/s 7B @ 20% (Up to Rs. 5M)',
    plainLanguage:
      'Profit on regular bank/financial-institution deposits and savings. Finance Act 2025 raised this from 15% to 20%. Final tax — only applies if your annual profit does NOT exceed Rs. 5 million. Auto-calculated at 20%.',
    example:
      'Your savings + term deposits across HBL/UBL paid Rs. 2,500,000 profit this year. As below Rs. 5M, tax = 20% × 2,500,000 = Rs. 500,000. Enter Amount 2,500,000.',
    fbrSection: 'Section 7B, Income Tax Ordinance 2001 (rate raised to 20% by Finance Act 2025)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  prize_raffle_lottery_quiz_promotional_156_amount: {
    title: 'Prize on Raffle / Lottery / Quiz / Promotion u/s 156 @ 20%',
    plainLanguage:
      'Final tax at 20% on winnings from raffles, lotteries, quiz shows, or sales-promotion prizes. The organiser usually withholds the tax before paying. Auto-calculated.',
    example:
      'You won Rs. 1,000,000 in a Telenor draw. Telenor withheld 20% = Rs. 200,000 and paid you Rs. 800,000. Enter Amount 1,000,000 — tax auto-fills 200,000.',
    fbrSection: 'Section 156, Income Tax Ordinance 2001 — Prizes and Winnings',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  prize_bond_cross_world_puzzle_156_amount: {
    title: 'Prize on Prize Bond / Crossword Puzzle u/s 156 @ 15%',
    plainLanguage:
      'Final tax at 15% on prize-bond winnings or crossword-puzzle prizes (lower than other prizes). State Bank withholds it before paying out. Auto-calculated.',
    example:
      'Your Rs. 40,000 denomination prize bond won Rs. 1,500,000. SBP withheld 15% = Rs. 225,000. You received Rs. 1,275,000. Enter Amount 1,500,000.',
    fbrSection: 'Section 156, Income Tax Ordinance 2001 — Prize Bonds',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  bonus_shares_companies_236f_amount: {
    title: 'Bonus Shares u/s 236Z @ 10%',
    plainLanguage:
      'Tax at 10% on the value of bonus shares issued to you by a company. Value = day-end market price on the first day of book closure (for listed companies) or prescribed value (for unlisted). The company normally collects this from you before transfer.',
    example:
      'Engro Corp issued you 1,000 bonus shares; on book-closure day the closing price was Rs. 280. Value = 280,000. Tax = 10% × 280,000 = Rs. 28,000. Enter Amount 280,000.',
    fbrSection: 'Section 236Z, Income Tax Ordinance 2001 — Bonus Shares',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  salary_arrears_12_7_relevant_rate_amount: {
    title: 'Salary Arrears u/s 12(7) — Variable Rate',
    plainLanguage:
      'Lump-sum arrears of salary received in the current year that relate to past tax years. You can choose to be taxed at the average rate of the year(s) the arrears relate to — usually lower than your current bracket. Enter Tax Chargeable MANUALLY (Amount × your average past rate).',
    example:
      'Your employer paid Rs. 600,000 salary arrears for 2022-23. Your average tax rate that year was 8%. Enter Amount 600,000 and Tax Chargeable 48,000 (8% × 600,000).',
    fbrSection: 'Section 12(7) read with Section 110, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default finalMinIncomeHelp;
