import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Scale,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const WealthReconciliationForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    formData,
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [unreconciledDifference, setUnreconciledDifference] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue
  } = useForm({
    defaultValues: getStepData('wealth_reconciliation')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Calculate wealth reconciliation from existing form data
  useEffect(() => {
    const calculateReconciliation = () => {
      try {
        setLoading(true);
        
        // Get data from wealth statement
        const wealthData = formData?.wealth || {};
        const incomeData = formData?.income || {};
        const deductionsData = formData?.deductions || {};
        const creditsData = formData?.credits || {};
        const expensesData = formData?.expenses || {};
        
        // Net Assets (from wealth statement)
        const netAssetsCurrentYear = parseFloat(wealthData.total_assets_current_year || 0) - 
                                   parseFloat(wealthData.total_liabilities_current_year || 0);
        const netAssetsPreviousYear = parseFloat(wealthData.total_assets_previous_year || 0) - 
                                    parseFloat(wealthData.total_liabilities_previous_year || 0);
        const netAssetsIncrease = netAssetsCurrentYear - netAssetsPreviousYear;
        
        // Income declared
        const incomeNormalTax = parseFloat(incomeData.total_taxable_income || 0);
        const incomeExemptFromTax = parseFloat(incomeData.total_exempt_income || 0);
        const incomeFinalTax = 0; // This would come from final tax forms if available
        
        // Adjustments and outflows
        const personalExpenses = parseFloat(watchedValues.personal_expenses || 0);
        const giftValue = parseFloat(watchedValues.gift_value || 0);
        const assetDisposalGainLoss = parseFloat(watchedValues.asset_disposal_gain_loss || 0);
        const foreignRemittance = parseFloat(watchedValues.foreign_remittance || 0);
        const inheritance = parseFloat(watchedValues.inheritance || 0);
        const otherInflows = parseFloat(watchedValues.other_inflows || 0);
        
        const adjustmentsInOutflows = parseFloat(watchedValues.adjustments_outflows || 0);
        const lossOnDisposal = parseFloat(watchedValues.loss_on_disposal || 0);
        
        // Total inflows calculation
        const totalInflows = incomeNormalTax + incomeExemptFromTax + incomeFinalTax +
                           foreignRemittance + inheritance + giftValue + 
                           assetDisposalGainLoss + otherInflows;
        
        // Total outflows calculation  
        const totalOutflows = personalExpenses + adjustmentsInOutflows + 
                            giftValue + lossOnDisposal;
        
        // Net increase/decrease in assets calculation
        const calculatedNetIncrease = totalInflows - totalOutflows;
        
        // Unreconciled difference (this MUST be zero for FBR compliance)
        const unreconciledDiff = netAssetsIncrease - calculatedNetIncrease;
        
        const reconciliation = {
          // Assets section
          netAssetsCurrentYear,
          netAssetsPreviousYear,
          netAssetsIncrease,
          
          // Inflows section
          incomeNormalTax,
          incomeExemptFromTax,
          incomeFinalTax,
          foreignRemittance,
          inheritance,
          giftValue: giftValue,
          assetDisposalGainLoss,
          otherInflows,
          totalInflows,
          
          // Outflows section
          personalExpenses,
          adjustmentsInOutflows,
          lossOnDisposal,
          totalOutflows,
          
          // Final calculation
          calculatedNetIncrease,
          unreconciledDifference: unreconciledDiff
        };
        
        setReconciliationData(reconciliation);
        setUnreconciledDifference(unreconciledDiff);
        
        // Auto-populate form fields
        Object.keys(reconciliation).forEach(key => {
          setValue(key, reconciliation[key]);
        });
        
      } catch (error) {
        console.error('Error calculating reconciliation:', error);
        toast.error('Error calculating wealth reconciliation');
      } finally {
        setLoading(false);
      }
    };

    if (formData && Object.keys(formData).length > 0) {
      calculateReconciliation();
    } else {
      setLoading(false);
    }
  }, [formData, watchedValues.personal_expenses, watchedValues.gift_value, 
      watchedValues.asset_disposal_gain_loss, watchedValues.foreign_remittance, 
      watchedValues.inheritance, watchedValues.other_inflows, 
      watchedValues.adjustments_outflows, watchedValues.loss_on_disposal, setValue]);

  const onSubmit = async (data) => {
    // FBR Compliance Check - Unreconciled difference MUST be zero
    if (Math.abs(unreconciledDifference) > 0.01) {
      toast.error('Cannot submit: Unreconciled difference must be zero. Please adjust your entries to balance the reconciliation.');
      return;
    }

    const success = await saveFormStep('wealth_reconciliation', data, true);
    if (success) {
      toast.success('Wealth reconciliation completed successfully');
      navigate('/tax-forms/tax-computation');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const success = await saveFormStep('wealth_reconciliation', data, false);
    if (success) {
      toast.success('Progress saved');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const inputClasses = "form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right";
  const readOnlyClasses = "form-input w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-right text-gray-700";

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Calculating wealth reconciliation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Scale className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wealth Reconciliation</h1>
              <p className="text-gray-600">Critical FBR compliance requirement - unreconciled difference must be zero</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Wealth Reconciliation Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Critical:</strong> Unreconciled difference MUST be zero for FBR submission</li>
              <li>• This reconciles your net worth increase with declared income and expenses</li>
              <li>• Auto-calculated from your wealth statement and income forms</li>
              <li>• Adjust personal expenses or other items to balance the reconciliation</li>
              <li>• Any unexplained wealth increase may trigger tax authority scrutiny</li>
            </ul>
          </div>
        )}

        {/* FBR Compliance Alert */}
        <div className={`mt-4 p-4 rounded-lg border ${
          Math.abs(unreconciledDifference) < 0.01 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-3">
            {Math.abs(unreconciledDifference) < 0.01 ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-600" />
            )}
            <div>
              <h4 className={`font-semibold ${
                Math.abs(unreconciledDifference) < 0.01 ? 'text-green-900' : 'text-red-900'
              }`}>
                {Math.abs(unreconciledDifference) < 0.01 ? 'FBR Compliance: PASSED' : 'FBR Compliance: FAILED'}
              </h4>
              <p className={`text-sm ${
                Math.abs(unreconciledDifference) < 0.01 ? 'text-green-800' : 'text-red-800'
              }`}>
                Unreconciled Difference: <strong>{formatCurrency(unreconciledDifference)}</strong>
                {Math.abs(unreconciledDifference) >= 0.01 && ' - Must be zero to submit tax return'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Wealth Reconciliation Table */}
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-blue-600 text-white py-3 px-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Wealth Reconciliation
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {/* Header Row */}
            <div className="bg-blue-100 grid grid-cols-12 gap-4 py-3 px-4 font-semibold text-blue-900">
              <div className="col-span-8">Description</div>
              <div className="col-span-4 text-right">Amount in PKR</div>
            </div>

            {/* Net Assets Section */}
            <div className="py-2 px-4 bg-blue-50">
              <h3 className="font-semibold text-blue-900">Net Assets</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Net Assets Current Year</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('netAssetsCurrentYear')}
                  className={readOnlyClasses}
                  value={reconciliationData?.netAssetsCurrentYear || 0}
                  readOnly
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Net Assets Previous Year</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('netAssetsPreviousYear')}
                  className={readOnlyClasses}
                  value={reconciliationData?.netAssetsPreviousYear || 0}
                  readOnly
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Increase / (Decrease) in Assets</div>
              <div className="col-span-4">
                <div className={`p-3 text-right font-bold text-lg ${
                  (reconciliationData?.netAssetsIncrease || 0) >= 0 ? 'text-blue-900' : 'text-red-600'
                }`}>
                  {formatCurrency(reconciliationData?.netAssetsIncrease || 0)}
                </div>
              </div>
            </div>

            {/* Inflows Section */}
            <div className="py-2 px-4 bg-green-50">
              <h3 className="font-semibold text-green-900">Inflows</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Income Declared as per Return for the year subject to Normal Tax</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('incomeNormalTax')}
                  className={readOnlyClasses}
                  value={reconciliationData?.incomeNormalTax || 0}
                  readOnly
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Income Declared as per Return for the year Exempt from Tax</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('incomeExemptFromTax')}
                  className={readOnlyClasses}
                  value={reconciliationData?.incomeExemptFromTax || 0}
                  readOnly
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Income Attributable to Receipts Declared as per Return for the year subject to Final / Fixed Tax and CGT</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('incomeFinalTax')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Foreign Remittance</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('foreign_remittance')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Inheritance</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('inheritance')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Gift (Value declard in gift deed)</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('gift_value')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Gain/(Loss) on Disposal of Assets (Excluding capital gain)</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('asset_disposal_gain_loss')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Others</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('other_inflows')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-green-50 font-semibold">
              <div className="col-span-8 text-green-900">Total Inflows</div>
              <div className="col-span-4">
                <div className="p-3 text-right font-bold text-lg text-green-900">
                  {formatCurrency(reconciliationData?.totalInflows || 0)}
                </div>
              </div>
            </div>

            {/* Outflows Section */}
            <div className="py-2 px-4 bg-red-50">
              <h3 className="font-semibold text-red-900">Outflows</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Personal Expenses</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('personal_expenses')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Adjustments in Outflows</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('adjustments_outflows')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Gift</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('gift_outflow')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Loss on Disposal of Assets</div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  {...register('loss_on_disposal')}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-red-50 font-semibold">
              <div className="col-span-8 text-red-900">Total Outflows</div>
              <div className="col-span-4">
                <div className="p-3 text-right font-bold text-lg text-red-900">
                  {formatCurrency(reconciliationData?.totalOutflows || 0)}
                </div>
              </div>
            </div>

            {/* Final Calculation */}
            <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900 text-lg">Net Increase/(Decrease) in Assets</div>
              <div className="col-span-4">
                <div className={`p-3 text-right font-bold text-xl ${
                  (reconciliationData?.calculatedNetIncrease || 0) >= 0 ? 'text-blue-900' : 'text-red-600'
                }`}>
                  {formatCurrency(reconciliationData?.calculatedNetIncrease || 0)}
                </div>
              </div>
            </div>
            
            {/* Critical: Unreconciled Difference */}
            <div className={`grid grid-cols-12 gap-4 py-4 px-4 font-bold border-4 ${
              Math.abs(unreconciledDifference) < 0.01 
                ? 'bg-green-50 border-green-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className={`col-span-8 text-xl flex items-center ${
                Math.abs(unreconciledDifference) < 0.01 ? 'text-green-900' : 'text-red-900'
              }`}>
                {Math.abs(unreconciledDifference) < 0.01 ? (
                  <CheckCircle className="w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="w-6 h-6 mr-2" />
                )}
                Unreconciled difference
              </div>
              <div className="col-span-4">
                <div className={`p-4 text-right font-bold text-2xl ${
                  Math.abs(unreconciledDifference) < 0.01 ? 'text-green-900' : 'text-red-900'
                }`}>
                  {formatCurrency(unreconciledDifference)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FBR Submission Requirements */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Info className="w-6 h-6 text-yellow-600 mt-1" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-2">FBR Submission Requirements</h3>
              <ul className="text-sm text-yellow-800 space-y-2">
                <li>• <strong>Critical:</strong> Unreconciled difference must be exactly zero (0) for successful submission</li>
                <li>• Adjust your personal expenses or other reconciliation items to balance the difference</li>
                <li>• This reconciliation ensures your wealth increase matches your declared income</li>
                <li>• Any significant unreconciled difference may trigger FBR audit and penalties</li>
                <li>• Save progress frequently while adjusting the reconciliation values</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/wealth')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Wealth Statement
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="flex items-center px-6 py-3 text-primary-600 bg-primary-100 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Progress'}
            </button>

            <button
              type="submit"
              disabled={saving || Math.abs(unreconciledDifference) >= 0.01}
              className={`flex items-center px-6 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                Math.abs(unreconciledDifference) < 0.01
                  ? 'text-white bg-green-600 hover:bg-green-700'
                  : 'text-gray-500 bg-gray-300 cursor-not-allowed'
              }`}
            >
              {Math.abs(unreconciledDifference) < 0.01 ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Completing...' : 
               Math.abs(unreconciledDifference) < 0.01 ? 'Complete Reconciliation' : 'Balance Required'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default WealthReconciliationForm;