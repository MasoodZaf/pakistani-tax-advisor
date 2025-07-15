import React, { useState } from 'react';
import { Calculator, X, Minimize2, Maximize2, Eye } from 'lucide-react';
import { currency, sumFields, TaxEngine } from '../../utils/taxUtils';

const FloatingSummary = ({ data, isVisible, setIsVisible }) => {
  const incFields = ["monthlySalary", "bonus", "carAllowance", "otherTaxable"];
  const totalIncome = sumFields(data.income, incFields);
  const taxableIncome = totalIncome - (+data.deductions.zakat || 0);
  const normalTax = TaxEngine.calcNormalTax(taxableIncome);
  const finalTax = TaxEngine.calcFinalTax(+data.finalTax.sukukAmount || 0, 0.10) + TaxEngine.calcFinalTax(+data.finalTax.debtAmount || 0, 0.15);
  const capitalGainTax = (+data.capitalGain.property1Year || 0)*0.15 + (+data.capitalGain.property2_3Years || 0)*0.10 + (+data.capitalGain.securities || 0)*0.125;
  const taxReductions = sumFields(data.reductions, ["teacherReduction", "behboodReduction"]);
  const taxCredits = TaxEngine.calcTaxCredit(+data.credits.charitableDonation || 0, taxableIncome, 1) +
    TaxEngine.calcTaxCredit(+data.credits.pensionContribution || 0, taxableIncome, 1);
  const totalTaxChargeable = Math.max(0, normalTax - taxReductions - taxCredits) + finalTax + capitalGainTax;
  const taxPaid = (+data.income.salaryTaxDeducted || 0) + (data.income.multipleEmployer === "Y" ? +data.income.additionalTaxDeducted || 0 : 0)
    + sumFields(data.capitalGain, ["property1YearTaxDeducted", "property2_3YearsTaxDeducted", "securitiesTaxDeducted"]);
  const refundDemand = taxPaid - totalTaxChargeable;
  const wealthFields = ["propertyCurrentYear", "investmentCurrentYear", "vehicleCurrentYear", "jewelryCurrentYear", "cashCurrentYear", "pfCurrentYear"];
  const netWorth = sumFields(data.wealth, wealthFields) - (+data.wealth.loanCurrentYear || 0);
  const [isMinimized, setIsMinimized] = useState(false);
  
  if (!isVisible) return (
    <button onClick={() => setIsVisible(true)} className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50">
      <Eye className="w-5 h-5" />
    </button>
  );
  
  return (
    <div className="fixed bottom-6 right-6 bg-white border-2 border-blue-200 rounded-lg shadow-xl z-50 w-80">
      <div className="bg-blue-50 px-4 py-2 rounded-t-lg border-b flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-blue-900 text-sm">Tax Summary</span>
        </div>
        <div className="flex space-x-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-blue-100 rounded">
            {isMinimized ? <Maximize2 className="w-4 h-4 text-blue-600" /> : <Minimize2 className="w-4 h-4 text-blue-600" />}
          </button>
          <button onClick={() => setIsVisible(false)} className="p-1 hover:bg-blue-100 rounded">
            <X className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className="p-4 space-y-3 text-xs">
          <div className="bg-green-50 p-2 rounded">
            <div className="font-semibold text-green-800 mb-1">Income</div>
            <div className="flex justify-between"><span>Total Salary:</span><span className="font-mono">{currency(totalIncome)}</span></div>
            <div className="flex justify-between"><span>Taxable Income:</span><span className="font-mono font-semibold">{currency(taxableIncome)}</span></div>
          </div>
          <div className="bg-yellow-50 p-2 rounded">
            <div className="font-semibold text-yellow-800 mb-1">Tax Calculation</div>
            <div className="flex justify-between"><span>Normal Tax:</span><span className="font-mono">{currency(normalTax)}</span></div>
            <div className="flex justify-between"><span>Final Tax:</span><span className="font-mono">{currency(finalTax)}</span></div>
            <div className="flex justify-between"><span>Capital Gain Tax:</span><span className="font-mono">{currency(capitalGainTax)}</span></div>
            <div className="flex justify-between text-xs text-gray-600"><span>Less: Reductions/Credits:</span><span className="font-mono">{currency(taxReductions + taxCredits)}</span></div>
            <div className="border-t pt-1 mt-1"><div className="flex justify-between font-semibold"><span>Total Tax Chargeable:</span><span className="font-mono text-yellow-800">{currency(totalTaxChargeable)}</span></div></div>
          </div>
          <div className={`p-2 rounded ${refundDemand >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`font-semibold mb-1 ${refundDemand >= 0 ? 'text-green-800' : 'text-red-800'}`}>Payment Status</div>
            <div className="flex justify-between"><span>Tax Paid:</span><span className="font-mono">{currency(taxPaid)}</span></div>
            <div className="border-t pt-1 mt-1">
              <div className="flex justify-between font-semibold"><span>{refundDemand >= 0 ? 'Refund Due:' : 'Additional Tax:'}</span>
                <span className={`font-mono ${refundDemand >= 0 ? 'text-green-800' : 'text-red-800'}`}>{currency(Math.abs(refundDemand))}</span>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 p-2 rounded">
            <div className="font-semibold text-blue-800 mb-1">Wealth</div>
            <div className="flex justify-between"><span>Net Worth:</span><span className="font-mono font-semibold text-blue-800">{currency(netWorth)}</span></div>
          </div>
          <div className="bg-gray-50 p-2 rounded text-center">
            <div className="text-gray-600">Effective Tax Rate</div>
            <div className="font-semibold text-gray-800">{taxableIncome > 0 ? ((totalTaxChargeable / taxableIncome) * 100).toFixed(2) : 0}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingSummary; 