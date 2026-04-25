/**
 * Knowledge base for the Wealth Reconciliation form (Section 116(2A), Income
 * Tax Ordinance 2001 — Reconciliation of Wealth).
 *
 * The reconciliation answers ONE question:
 *   "How did your net worth change from last 30 June to this 30 June?"
 *
 * The math is simple but rigid:
 *   Increase in Net Assets  =  Total Inflows  -  Total Outflows
 *
 * Every rupee on each side must be accounted for — that's why the
 * "Unreconciled Difference" MUST equal zero before FBR will accept the
 * return. The fields below are the levers users adjust to make the equation
 * balance honestly.
 *
 * Authoring rules:
 *   - plainLanguage: explain WHY the field exists in the context of the
 *     zero-difference rule, not just what number to enter.
 *   - example: a concrete Pakistani scenario with PKR amounts.
 *   - fbrSection: legal anchor.
 *   - fbrUrl: where the user can verify the rule themselves.
 */

const wealthReconciliationHelp = {
  foreign_remittance: {
    title: 'Foreign Remittance',
    plainLanguage:
      'Money sent to you from abroad through legal banking channels (SWIFT, Western Union, Wise, exchange-company wire). This is a HUGE inflow lever because remittances are tax-free and explain wealth increases without raising questions — but only if the money came through the banking system with a remittance certificate. Cash brought in personally does not count.',
    example:
      'Your brother in Dubai sent you USD 12,000 over the year via bank wire — at SBP\'s average rate ≈ Rs. 33,60,000. Enter 3,360,000. This now legitimately covers Rs. 33.6 lakh of your net-worth increase without you needing to show extra income.',
    fbrSection: 'Section 111(4) + Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  inheritance: {
    title: 'Inheritance Received',
    plainLanguage:
      'Cash, property, or assets you inherited during the year from a deceased relative. Inheritance is fully exempt from tax but MUST be declared here — otherwise the inherited amount looks like unexplained wealth and the unreconciled difference won\'t close to zero. Keep the death certificate and succession-mutation papers as backup.',
    example:
      'Your father passed away in November 2024. You inherited 1/4 share of a house valued at Rs. 80,00,000 (your share = Rs. 20,00,000) plus Rs. 5,00,000 cash from his bank. Enter 2,500,000. The Rs. 20 lakh property share also appears in your Wealth Statement under Immovable Property at the inherited value.',
    fbrSection: 'Section 39(3) + Clause 47, Part I, Second Schedule (Inheritance exempt)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  gift_value: {
    title: 'Gift Received (Inflow)',
    plainLanguage:
      'Cash or assets GIFTED to you during the year by a relative — typically parents, spouse, siblings, children. Gifts received from blood relatives are tax-exempt but you must declare them here so they explain the matching wealth increase. The giver should ideally have a written gift deed and the gift should move through banking channels (cheque/transfer), not cash.',
    example:
      'On your wedding, your father gifted you Rs. 15,00,000 by cross-cheque + your mother gifted gold jewelry worth Rs. 5,00,000 (with a gift deed). Enter 2,000,000. The cash boosted your bank balance and the jewelry shows up in Wealth Statement — both are now explained.',
    fbrSection: 'Section 39(3) + Clause 47, Part I, Second Schedule (Gifts from relatives exempt)',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  asset_disposal_gain_loss: {
    title: 'Gain / (Loss) on Disposal of Assets',
    plainLanguage:
      'When you sell an asset (car, plot, equipment) at MORE or LESS than its cost — and it isn\'t a capital-gains-taxable transaction (those go on the CGT form). Enter the gain as a positive number, or a loss as a negative. This adjusts your inflows so the cash you actually received matches the asset cost you removed from the Wealth Statement.',
    example:
      'You sold your old Honda City for Rs. 18,00,000. Original cost in your Wealth Statement was Rs. 14,00,000. Gain = Rs. 4,00,000. Enter 400,000. Your bank balance went up by Rs. 18 lakh, vehicles went down by Rs. 14 lakh — the Rs. 4 lakh gain explains the rest. (If you sold at a Rs. 2,00,000 loss, enter -200,000.)',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  other_inflows: {
    title: 'Other Inflows',
    plainLanguage:
      'Any legitimate cash that came in during the year that isn\'t already covered above — loan received from a family member (matching liability also goes up), insurance maturity, lottery/prize money already taxed, refund of an old security deposit, recovery of a written-off debt. Use this as the "catch-all" to close small gaps in the reconciliation.',
    example:
      'You took a Rs. 3,00,000 interest-free loan from your brother (the matching amount appears in Other Liabilities on the Wealth Statement) and your old electricity security deposit of Rs. 30,000 was refunded. Enter 330,000.',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  personal_expenses: {
    title: 'Personal Expenses',
    plainLanguage:
      'Total household and lifestyle spending for the year — rent/utilities, groceries, school fees, medical, travel, vehicle running, club fees, helpers\' salaries. This is auto-pulled from the Personal Expenses form, but you can override here. Be realistic: declaring Rs. 50,000/month total expenses while your wealth grew by lakhs is the #1 trigger for FBR audit notices.',
    example:
      'A middle-class Lahore family of 4 typically spends Rs. 80,000 - 1,50,000 per month = Rs. 9,60,000 - 18,00,000 per year on rent, food, school, utilities, medical, fuel and travel. If your Expenses form totals Rs. 14,40,000, that figure auto-populates. Override only if you have a clear reason.',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  adjustments_outflows: {
    title: 'Adjustments in Outflows',
    plainLanguage:
      'Non-expense outflows that still reduced your cash during the year — tax paid (income tax, advance tax, withholding tax that came out of your pocket on top of what was deducted at source), Zakat paid, charitable donations, life-insurance premiums, voluntary tax payments. These weren\'t lifestyle spending but they DID consume cash, so they belong on the outflows side to balance the equation.',
    example:
      'During the year you paid Rs. 1,80,000 in advance income tax via challans + Rs. 75,000 Zakat + Rs. 1,20,000 in life-insurance premiums = Rs. 3,75,000. Enter 375,000. (If your tax was deducted at source by your employer, do NOT add it here — it\'s already netted out within your Income figures.)',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  gift_outflow: {
    title: 'Gift Given (Outflow)',
    plainLanguage:
      'Cash or assets you GAVE as a gift during the year — to a child, sibling, spouse, parent, or any relative. This is the mirror of "Gift Received": you reduced your wealth by gifting, so the outflow side records that reduction. Use a banking channel and a written gift deed for amounts above a few lakh, otherwise the gift can be challenged.',
    example:
      'You gifted Rs. 10,00,000 by cross-cheque to your son for his university tuition abroad and gave your sister Rs. 2,00,000 cash on her wedding. Enter 1,200,000. Your bank balance will be lower by these amounts on 30 June — this entry explains why.',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },

  loss_on_disposal: {
    title: 'Loss on Disposal of Assets',
    plainLanguage:
      'A separate line for losses when you sold an asset for less than its book cost (if you didn\'t already net it into the Gain/(Loss) inflow row). Some users prefer to record gains as inflows and losses as outflows separately for clarity. Enter only if you haven\'t already captured the loss above as a negative gain.',
    example:
      'You scrapped business equipment that cost Rs. 5,00,000 and got only Rs. 50,000 from the buyer. Loss = Rs. 4,50,000. If you entered Gain/(Loss) as 0 above, enter 450,000 here. (If you already entered -450,000 above, leave this row at 0 — don\'t double-count.)',
    fbrSection: 'Section 116(2A), Income Tax Ordinance 2001',
    fbrUrl: 'https://download1.fbr.gov.pk/Docs/202210171810158861IncomeTaxOrdinanceUpdated30062022.pdf',
  },
};

export default wealthReconciliationHelp;
