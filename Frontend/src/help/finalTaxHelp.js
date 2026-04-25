/**
 * Knowledge base for the Final Tax form.
 *
 * Final tax = tax that fully discharges your liability on a particular income
 * source. The withholding is the final tax — no further computation, no
 * refund, not added to slab income. Covers prize bonds, NSS, dividends,
 * capital gain on listed securities, commission etc. References Income Tax
 * Ordinance 2001 + Finance Act 2025.
 *
 * Keys here match the `id` in FINAL_TAX_ITEMS so <HelpHint fieldId={item.id} />
 * picks up the right entry for each row label.
 */

const finalTaxHelp = {
  prize_bond_winnings: {
    title: 'Winnings from Prize Bonds u/s 156',
    plainLanguage:
      'Prize money won on prize bonds — taxed as final at 15% (rate set by Finance Act 2025). State Bank deducts the tax before paying you. Enter the gross prize won; tax auto-calculates.',
    example:
      'Your Rs. 40,000 prize bond won Rs. 1,500,000. SBP withheld 15% = Rs. 225,000 and paid you Rs. 1,275,000. Enter Gross Amount 1,500,000.',
    fbrSection: 'Section 156, Income Tax Ordinance 2001 — Prize Bonds',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  lottery_crossword_winnings: {
    title: 'Winnings from Lottery / Raffle / Quiz / Crossword u/s 156A',
    plainLanguage:
      'Final tax at 20% on winnings from sales-promotion schemes, raffles, lotteries, TV quiz shows, crossword puzzles. Organiser deducts at source. Auto-calculated.',
    example:
      'You won Rs. 500,000 in a Coca-Cola consumer raffle. The company withheld 20% = Rs. 100,000 and paid you Rs. 400,000. Enter Gross 500,000.',
    fbrSection: 'Section 156A, Income Tax Ordinance 2001 — Promotional Winnings',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_govt_securities: {
    title: 'Profit on NSS / Post Office Savings u/s 151(1)(a)',
    plainLanguage:
      'Profit on National Savings Schemes (Behbood, Pensioners\' Benefit, Regular Income Certificates, Savings Account, etc.) and Post Office Savings — withheld as FINAL tax by CDNS at the prescribed rate. Auto-calculated.',
    example:
      'You earned Rs. 600,000 profit on Regular Income Certificates this year. CDNS withheld at the applicable rate before paying. Enter Gross 600,000 — tax auto-fills.',
    fbrSection: 'Section 151(1)(a), Income Tax Ordinance 2001 — NSS & Post Office',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  profit_defence_savings: {
    title: 'Profit on Defence Savings Certificates u/s 151(1)(b)',
    plainLanguage:
      'Profit / encashment proceeds on Defence Savings Certificates (DSCs) — final WHT at the rate applicable to the year of investment. CDNS deducts before paying out. Auto-calculated using the current rate.',
    example:
      'You encashed DSCs and received Rs. 800,000 profit. Tax was withheld by CDNS at the applicable final rate. Enter Gross 800,000 — tax field auto-fills based on current rate.',
    fbrSection: 'Section 151(1)(b), Income Tax Ordinance 2001 — Defence Savings Certificates',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  dividend_listed_companies: {
    title: 'Dividend from Listed Companies u/s 150',
    plainLanguage:
      'Dividend from PSX-listed companies. Final tax at the applicable Division III rate (typically 15% for ATL filers). The company withholds before paying you — verify with the dividend warrant / CDC tax certificate. Auto-calculated.',
    example:
      'You received Rs. 200,000 dividend from MCB Bank. As ATL filer, MCB withheld 15% = Rs. 30,000. Enter Gross 200,000 — tax auto-fills 30,000.',
    fbrSection: 'Section 150 + Division III, Part I, First Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  dividend_other: {
    title: 'Dividend from Other / Unlisted / Mutual Funds u/s 150',
    plainLanguage:
      'Dividend from non-listed companies, mutual funds, or special-vehicle dividends not in the standard 15% bracket. Rate varies (25% for funds with high debt content, 35% for some SPVs). Auto-calculated using the applicable category rate.',
    example:
      'You received Rs. 300,000 dividend from a mutual fund with 60% profit-on-debt component. As ATL filer, fund withheld 25% = Rs. 75,000. Enter Gross 300,000.',
    fbrSection: 'Section 150 + Division III, Part I, First Schedule, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  capital_gain_securities_less_12m: {
    title: 'Capital Gain on Securities — Holding < 12 Months u/s 37A',
    plainLanguage:
      'Final tax on capital gain from PSX-listed securities held LESS than 12 months — short-term. Higher rates apply to discourage short-holding. NCCPL deducts on settlement; you get an annual NCCPL certificate. Enter the gross gain; tax auto-calculates.',
    example:
      'You bought TRG Pakistan shares in March 2026 and sold in Aug 2026, gaining Rs. 400,000 (held < 12 months). NCCPL withheld at the applicable short-term rate. Enter Gross 400,000.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Capital Gain on Securities',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  capital_gain_securities_over_12m: {
    title: 'Capital Gain on Securities — Holding ≥ 12 Months u/s 37A',
    plainLanguage:
      'Final tax on capital gain from PSX-listed securities held 12 months or more — long-term. Concessional rate applies. NCCPL withholds on settlement; check your NCCPL Annual Tax Certificate.',
    example:
      'You bought MEBL shares in Jan 2024 and sold in Mar 2026, gaining Rs. 600,000 (held > 24 months). NCCPL withheld at the applicable long-term rate. Enter Gross 600,000.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Capital Gain on Securities',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  commission_agents: {
    title: 'Commission to Stock Exchange Members / Agents u/s 233',
    plainLanguage:
      'Final tax on commission income earned as a stock-broker, insurance agent, advertising agent, or general commission agent. The principal (company paying you) withholds at source. Auto-calculated.',
    example:
      'You worked as an EFU Life insurance agent and earned Rs. 500,000 commission this year. EFU withheld at the applicable rate before paying. Enter Gross 500,000.',
    fbrSection: 'Section 233, Income Tax Ordinance 2001 — Brokerage and Commission',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_final_tax: {
    title: 'Other Income Subject to Final Tax',
    plainLanguage:
      'Catch-all for any final-tax income not covered elsewhere — e.g. specific small categories or ad-hoc final-tax regimes. Enter the gross amount AND the tax manually since rates vary case-by-case.',
    example:
      'You received Rs. 100,000 under a specific final-tax regime where the deductor withheld Rs. 15,000. Enter Gross 100,000 and Tax 15,000 (both manually).',
    fbrSection: 'Various — see specific section in FBR Ordinance 2001 / Finance Act 2025',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default finalTaxHelp;
