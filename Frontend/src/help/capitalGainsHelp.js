/**
 * Knowledge base for the Capital Gains form.
 *
 * Each entry is plain-language guidance sourced from FBR's published regime —
 * Income Tax Ordinance 2001 (Sections 37 & 37A) and Finance Act 2025 capital
 * gain rate schedule. Keys match the `item.id` used in CapitalGainsForm so
 * <HelpHint fieldId="..." /> can pick the right entry.
 *
 * Authoring rules (same as incomeFormHelp.js):
 *   - plainLanguage: 1-3 sentences in plain Pakistani-English. No legalese.
 *   - example: a concrete Pakistani PKR scenario.
 *   - fbrSection: legal anchor.
 *   - fbrUrl: where the user can verify.
 */

const capitalGainsHelp = {
  // ── Immovable Property u/s 37(1A) ─────────────────────────────────────────
  immovable_property_1_year: {
    title: 'Property Sold Within 1 Year of Purchase',
    plainLanguage:
      'Capital gain on a plot, house, flat, or commercial unit you sold within 12 months of buying it. Short holding gets the highest CGT rate — Finance Act 2025 sets this slab at 15% for property bought before 1 July 2024.',
    example:
      'You bought a 5-marla plot in Bahria Town for Rs. 8,000,000 in March 2024 and sold it in October 2024 for Rs. 10,500,000. Gain = Rs. 2,500,000. Enter 2,500,000 — system applies 15% = Rs. 375,000 CGT.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — read with First Schedule, Division VIII (Finance Act 2025)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_2_years: {
    title: 'Property Held 1 to 2 Years',
    plainLanguage:
      'Capital gain on immovable property you owned for more than 1 year but not more than 2 years before selling. CGT rate steps down a notch from the 1-year slab.',
    example:
      'You bought a flat in DHA Karachi for Rs. 15,000,000 in February 2023 and sold it in May 2025 for Rs. 18,000,000. Holding period ≈ 2 years 3 months — wait, that\'s the next slab. If you sold in January 2025 (≈ 23 months), gain Rs. 3,000,000 goes here.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_3_years: {
    title: 'Property Held 2 to 3 Years',
    plainLanguage:
      'Capital gain on immovable property held for more than 2 years but not more than 3 years. Rate continues to taper down as the holding period gets longer.',
    example:
      'You bought a shop in Anarkali Bazaar Lahore for Rs. 6,000,000 in June 2022 and sold it in May 2025 for Rs. 7,800,000. Holding ≈ 2 years 11 months. Enter the gain Rs. 1,800,000 here.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_4_years: {
    title: 'Property Held 3 to 4 Years',
    plainLanguage:
      'Capital gain on immovable property held more than 3 years but not more than 4 years. Mid-range holding period — CGT rate is significantly lower than the 1-year slab.',
    example:
      'You bought a 10-marla house in Islamabad for Rs. 25,000,000 in April 2021 and sold it in February 2025 for Rs. 32,000,000. Holding ≈ 3 years 10 months. Enter the gain Rs. 7,000,000 here.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_5_years: {
    title: 'Property Held 4 to 5 Years',
    plainLanguage:
      'Capital gain on immovable property held more than 4 years but not more than 5 years. Long holding — CGT rate further reduced.',
    example:
      'You bought a plot in Gulberg Greens for Rs. 12,000,000 in May 2020 and sold it in March 2025 for Rs. 17,000,000. Holding ≈ 4 years 10 months. Enter the gain Rs. 5,000,000 here.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_6_years: {
    title: 'Property Held 5 to 6 Years',
    plainLanguage:
      'Capital gain on immovable property held more than 5 years but not more than 6 years. Lowest non-zero slab on the holding-period ladder.',
    example:
      'You bought a 1-kanal house in DHA Phase 6 Lahore for Rs. 35,000,000 in June 2019 and sold it in April 2025 for Rs. 50,000,000. Holding ≈ 5 years 10 months. Enter the gain Rs. 15,000,000 here.',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  immovable_property_over_6_years: {
    title: 'Property Held More Than 6 Years',
    plainLanguage:
      'Capital gain on immovable property you held for more than 6 years. For property acquired before 1 July 2024, gain at this holding period is exempt — CGT rate is 0%. Still enter the gain so it shows on your return; the system applies NIL automatically.',
    example:
      'You bought a plot in Wapda Town Multan in 2017 for Rs. 4,000,000 and sold it in 2025 for Rs. 9,000,000. Gain Rs. 5,000,000. Enter 5,000,000 — CGT comes out to zero (NIL).',
    fbrSection: 'Section 37(1A), Income Tax Ordinance 2001 — Division VIII, First Schedule (>6 years exempt)',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  // ── Securities u/s 37A ────────────────────────────────────────────────────
  securities_before_july_2013: {
    title: 'Securities Acquired Before 1 July 2013',
    plainLanguage:
      'Gain on listed shares, modaraba certificates, or other securities you bought before 1 July 2013. Gains on these are exempt under Section 37A — rate is 0%. Still report the gain figure here for disclosure.',
    example:
      'You held PSO shares since 2010, bought at Rs. 200,000 total cost. You sold them in August 2024 for Rs. 850,000. Gain = Rs. 650,000. Enter 650,000 — CGT comes out to NIL.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — pre-2013 acquisitions exempt',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  securities_pmex_settled: {
    title: 'PMEX / Cash-Settled Securities',
    plainLanguage:
      'Gains from Pakistan Mercantile Exchange (PMEX) — gold, silver, currency futures, commodities — and other cash-settled derivative contracts. These have their own flat CGT rate under Section 37A.',
    example:
      'You traded gold futures on PMEX through your broker and netted Rs. 400,000 in cash-settled gains across the year. Enter 400,000 here.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — PMEX/cash-settled instruments',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_37a_7_5_percent: {
    title: 'Securities u/s 37A — Standard Slab',
    plainLanguage:
      'Gain on listed equity securities falling into the standard CGT slab under Section 37A. The system applies the rate from the Finance Act 2025 schedule automatically based on your acquisition date and security type.',
    example:
      'You bought 1,000 HBL shares at Rs. 110 in May 2024 and sold them at Rs. 145 in March 2025. Gain = (145 - 110) × 1,000 = Rs. 35,000. Enter 35,000 here.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Division VII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_mutual_funds_10_percent: {
    title: 'Mutual Funds / Collective Schemes / REIT — 10% Slab',
    plainLanguage:
      'Gain on units of mutual funds, collective investment schemes, or REIT units that fall into the 10% CGT category under Section 37A. Most income/money-market fund gains land here.',
    example:
      'You invested Rs. 1,000,000 in NBP Income Fund. Over the year you redeemed units realizing a gain of Rs. 90,000. Enter 90,000 — system applies 10% = Rs. 9,000 CGT.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Mutual Funds / REIT',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_mutual_funds_12_5_percent: {
    title: 'Mutual Funds / REIT — Stock Funds',
    plainLanguage:
      'Gain on units of equity-based (stock) mutual funds and stock-focused collective investment schemes. Slightly higher CGT rate than income/money-market funds because of higher returns potential.',
    example:
      'You bought UBL Stock Advantage Fund units worth Rs. 500,000 and redeemed them after 14 months for Rs. 600,000. Gain = Rs. 100,000. Enter 100,000 here.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Stock Funds',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_other_25_percent: {
    title: 'Mutual Funds / REIT — Other than Stock Funds (25%)',
    plainLanguage:
      'Higher CGT rate slab for certain mutual fund or REIT units that are not stock funds — typically applies to corporate or non-individual unit-holders, or specific fund classes specified in the Finance Act 2025.',
    example:
      'A company-held position in MCB Pakistan Cash Management Fund redeemed with Rs. 300,000 gain. If the fund/holder type pulls this into the 25% slab, enter 300,000 here.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — non-stock fund category',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_12_5_percent_before_july_2022: {
    title: 'Securities Acquired Before 1 July 2022',
    plainLanguage:
      'Listed securities bought before 1 July 2022 fall under a transitional slab regardless of holding period. Use this row if your acquisition predates that cut-off and the security is not in any other specific category above.',
    example:
      'You bought 500 OGDC shares in March 2021 at Rs. 95 and sold them in 2024 at Rs. 130. Gain = (130 - 95) × 500 = Rs. 17,500. Enter 17,500 here.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — pre-July-2022 acquisitions',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  securities_15_percent: {
    title: 'Securities u/s 37A — 15% Slab',
    plainLanguage:
      'Gain on listed securities that fall in the 15% CGT slab under the Finance Act 2025 rate schedule — typically newer acquisitions or specific filer categories.',
    example:
      'You bought 200 Engro Corp shares at Rs. 280 in October 2024 and sold them at Rs. 340 in May 2025. Gain = (340 - 280) × 200 = Rs. 12,000. Enter 12,000 here — system applies 15% = Rs. 1,800.',
    fbrSection: 'Section 37A, Income Tax Ordinance 2001 — Division VII, First Schedule',
    fbrUrl: 'https://download1.fbr.gov.pk/SROs/2025FA.pdf',
  },

  // ── Tax-deducted and carryable inputs (apply to every row) ───────────────
  // We key these on the per-item DB column suffix so HelpHint can cite them
  // from a single shared explanation when a row needs it. The form itself
  // doesn't have separate labels for these — guidance is per-row description.
  tax_deducted_general: {
    title: 'Tax Already Deducted (Withholding)',
    plainLanguage:
      'Advance/withholding tax that was already deducted at source — for property, this is usually Section 236C tax taken by the registrar at the time of sale; for securities, NCCPL deducts CGT at source. Enter the amount that was withheld so it offsets your CGT liability.',
    example:
      'You sold a plot for Rs. 10,000,000. Registrar deducted 3% under Section 236C = Rs. 300,000. Enter 300,000 in the Tax Deducted column for that row.',
    fbrSection: 'Sections 236C / 100B, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  tax_carryable_general: {
    title: 'Tax Carryable to Computation',
    plainLanguage:
      'The net CGT amount that flows from this row into your final tax computation summary. Usually equals the auto-calculated CGT minus any tax already deducted. If withholding fully covered CGT, this should be zero or close to zero.',
    example:
      'CGT auto-calculated Rs. 150,000. Tax already deducted Rs. 300,000 (over-withheld). Carryable = 0; the excess Rs. 150,000 becomes a refund/adjustment elsewhere.',
    fbrSection: 'Section 37 + Section 100B, Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default capitalGainsHelp;
