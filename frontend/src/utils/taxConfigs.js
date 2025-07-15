export const configs = {
  income: [
    ["Monthly Salary", "monthlySalary"],
    ["Bonus", "bonus"],
    ["Taxable value of Car", "carAllowance"],
    ["Other taxable payments", "otherTaxable"],
    ["Salary Tax Deducted", "salaryTaxDeducted"],
    ["Do You have more than one employer?", "multipleEmployer", "dropdown"],
    ["Additional Tax Deducted", "additionalTaxDeducted", "number", "conditional", "multipleEmployer", "Y"],
    ["Medical Allowance", "medicalAllowance"],
    ["Employer Contribution", "employerContribution"],
    ["Other Exempt", "otherExempt"],
    ["Other Sources", "otherSources"],
  ],
  adjustableTax: [
    ["Profit on Debt u/s 151 @15%", "profitOnDebt"],
    ["Profit on Debt Tax Collected", "profitOnDebtTax"],
    ["Electricity Bill (Domestic)", "electricityBill"],
    ["Electricity Tax Collected", "electricityTax"],
    ["Telephone/Internet Bill", "phoneBill"],
    ["Telephone/Internet Tax", "phoneTax"],
    ["Vehicle Registration/Transfer", "vehicleAmount"],
    ["Vehicle Tax Collected", "vehicleTax"],
    ["Other Adjustable Tax", "otherTax"],
  ],
  reductions: [
    ["Teacher's Amount", "teacherAmount"],
    ["Teacher Reduction", "teacherReduction"],
    ["Behbood Reduction", "behboodReduction"]
  ],
  credits: [
    ["Charitable Donation", "charitableDonation"],
    ["Pension Contribution", "pensionContribution"]
  ],
  deductions: [
    ["Zakat", "zakat"]
  ],
  finalTax: [
    ["Sukuk Amount", "sukukAmount"],
    ["Debt Amount", "debtAmount"]
  ],
  capitalGain: [
    ["Property (1 yr)", "property1Year"],
    ["Property (1 yr) Tax Deducted", "property1YearTaxDeducted"],
    ["Property (2-3 yrs)", "property2_3Years"],
    ["Property (2-3 yrs) Tax Deducted", "property2_3YearsTaxDeducted"],
    ["Securities", "securities"],
    ["Securities Tax Deducted", "securitiesTaxDeducted"]
  ],
  expenses: [
    ["Rent", "rent"], ["Rates", "rates"], ["Income Tax Paid", "incomeTax"], ["Vehicle", "vehicle"],
    ["Travelling", "travelling"], ["Electricity", "electricity"], ["Water", "water"], ["Gas", "gas"],
    ["Telephone", "telephone"], ["Medical", "medical"], ["Educational", "educational"], ["Donations", "donations"],
    ["Other Expenses", "otherExpenses"]
  ],
  wealth: [
    ["Property Previous", "propertyPreviousYear"], ["Property Current", "propertyCurrentYear"],
    ["Investment Previous", "investmentPreviousYear"], ["Investment Current", "investmentCurrentYear"],
    ["Vehicle Previous", "vehiclePreviousYear"], ["Vehicle Current", "vehicleCurrentYear"],
    ["Jewelry Previous", "jewelryPreviousYear"], ["Jewelry Current", "jewelryCurrentYear"],
    ["Cash Previous", "cashPreviousYear"], ["Cash Current", "cashCurrentYear"],
    ["PF Previous", "pfPreviousYear"], ["PF Current", "pfCurrentYear"],
    ["Loan Previous", "loanPreviousYear"], ["Loan Current", "loanCurrentYear"]
  ]
}; 