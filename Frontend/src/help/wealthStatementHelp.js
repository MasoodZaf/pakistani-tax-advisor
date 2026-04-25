/**
 * Knowledge base for the Wealth Statement form (Section 116, Income Tax
 * Ordinance 2001).
 *
 * Each entry maps to a row's `key` in the form (e.g. `property`, `loan`).
 * The same help applies to both the Previous Year and Current Year columns,
 * so we keep a single entry per asset/liability concept.
 *
 * Authoring rules:
 *   - plainLanguage: 1-3 sentences, plain Pakistani-English. Never legalese.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor (e.g. "Section 116, Income Tax Ordinance 2001")
 *   - fbrUrl: where the user can verify the rule themselves
 */

const wealthStatementHelp = {
  property: {
    title: 'Immovable Property',
    plainLanguage:
      'All land and buildings you own — house, plot, shop, agricultural land, commercial property, inherited property — entered at COST (the price you paid plus stamp duty/registration), NOT today\'s market value. Use the same cost figure year after year unless you bought, sold, or made a major addition.',
    example:
      'You bought a 10 marla house in DHA Lahore in 2019 for Rs. 2,50,00,000 plus Rs. 12,50,000 in stamp duty/registration. Enter Rs. 2,62,50,000 in BOTH previous-year and current-year columns. If you also bought a Rs. 80,00,000 plot this year, current-year becomes Rs. 3,42,50,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  investment: {
    title: 'Investments / Securities',
    plainLanguage:
      'Money you have parked in investments — shares listed on PSX, mutual funds, NSS certificates (DSC, Behbood, Regular Income Certificates), Sukook, prize bonds, private company shares. Enter the COST of acquisition, not the current market price.',
    example:
      'You hold Rs. 15,00,000 in NSS Defence Savings Certificates + Rs. 5,00,000 in MCB Pakistan Stock Market Fund + Rs. 2,00,000 in PSX listed shares. Enter Rs. 22,00,000. If you bought Rs. 3,00,000 more shares this year, current-year column becomes Rs. 25,00,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  vehicle: {
    title: 'Motor Vehicles',
    plainLanguage:
      'Every vehicle registered in your name — car, bike, jeep, pickup, tractor. Enter at COST including registration and token. Don\'t depreciate it down each year; FBR uses original cost. If you sold a car, drop it from current-year and capture the sale proceeds in cash/bank.',
    example:
      'You own a 2022 Toyota Corolla bought for Rs. 45,00,000 (including registration) and a Honda CD-70 bought for Rs. 1,80,000. Enter Rs. 46,80,000 in both columns. If you sold the bike this year for Rs. 1,50,000, current-year drops to Rs. 45,00,000 and the cash goes into Bank Balances.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  jewelry: {
    title: 'Jewelry / Valuables',
    plainLanguage:
      'Gold, silver, diamond, and gemstone jewelry; antiques; rare watches; artwork. Enter the COST when you (or the gift-giver) acquired it. Keep this amount stable across years unless you bought or sold something — gold price fluctuations don\'t change the cost basis.',
    example:
      'Your wife inherited gold jewelry worth Rs. 8,00,000 at the time of inheritance (2018) and you bought a Rs. 2,00,000 set on her birthday last year. Enter Rs. 10,00,000 in both columns. If you bought another Rs. 3,00,000 set this year, current-year becomes Rs. 13,00,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  cash: {
    title: 'Cash in Hand',
    plainLanguage:
      'Physical cash you keep at home or office on 30 June — NOT money in bank accounts (that goes under Bank Balances). Be realistic: declaring lakhs of cash-in-hand without a clear source is a common audit trigger. Most filers keep this small.',
    example:
      'On 30 June 2025 you had Rs. 50,000 cash at home for monthly expenses and Rs. 20,000 in your wallet. Enter Rs. 70,000 in current-year. If last year you had Rs. 60,000 on the same date, that goes in previous-year.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  pf: {
    title: 'Provident Fund Balance',
    plainLanguage:
      'Your accumulated balance in an employer-run Provident Fund (PF) as on 30 June — both your contribution and the employer\'s. Get the figure from your latest PF statement. Don\'t include EOBI; that\'s a separate scheme and isn\'t part of your wealth.',
    example:
      'Your PF statement at 30 June 2025 shows a closing balance of Rs. 18,50,000 (your share + employer share + accrued profit). Enter that amount in current-year. The 30 June 2024 closing balance from last year\'s statement goes in previous-year.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  bank_balance: {
    title: 'Bank Balances',
    plainLanguage:
      'Combined balance of every bank account in your name on 30 June — current accounts, savings accounts, term deposits, foreign currency accounts (converted to PKR at SBP rate), and digital wallets like JazzCash/Easypaisa. Sum every account and enter one number.',
    example:
      'On 30 June 2025: HBL current Rs. 1,20,000 + Meezan savings Rs. 8,50,000 + UBL term deposit Rs. 15,00,000 + a USD account with $2,000 ≈ Rs. 5,60,000 + JazzCash wallet Rs. 30,000 = Rs. 30,60,000. Enter Rs. 30,60,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_assets: {
    title: 'Other Assets',
    plainLanguage:
      'Anything you own that doesn\'t fit the rows above — receivables (money owed to you), advances/security deposits paid for rent or utilities, business equipment, livestock, intellectual property, foreign assets. If unsure, list it here rather than skip it.',
    example:
      'You paid a Rs. 4,00,000 security deposit when you rented your shop, and a friend owes you Rs. 1,50,000 (documented). Enter Rs. 5,50,000. If you also have an export receivable of Rs. 8,00,000, current-year becomes Rs. 13,50,000.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  loan: {
    title: 'Loans / Mortgages',
    plainLanguage:
      'Outstanding principal balance you still owe on 30 June — house finance/mortgage, car loan, personal loan, credit-card outstanding (if material), business loan from a bank. Use the bank statement balance, not the original loan amount. Goes down each year as you make payments.',
    example:
      'You took a Rs. 60,00,000 home finance from HBL in 2022. After 3 years of payments, the bank statement at 30 June 2025 shows outstanding Rs. 48,50,000. Enter Rs. 48,50,000 in current-year. The 30 June 2024 outstanding (say Rs. 53,00,000) goes in previous-year.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_liabilities: {
    title: 'Other Liabilities',
    plainLanguage:
      'Money you owe that isn\'t a formal bank loan — interest-free loans from family/friends, supplier payables in your business, advances received from tenants, unpaid taxes, committee/BC obligations you still owe. Enter the outstanding amount as on 30 June.',
    example:
      'Your father lent you Rs. 5,00,000 (interest-free) toward your car down-payment and Rs. 1,50,000 is still outstanding on 30 June 2025. You also have a Rs. 80,000 unpaid contractor bill. Enter Rs. 2,30,000 in current-year.',
    fbrSection: 'Section 116, Income Tax Ordinance 2001 — Wealth Statement',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default wealthStatementHelp;
