import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Gem,
  Home,
  TrendingUp,
  Car,
  DollarSign,
  Briefcase,
  CreditCard,
  Info,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const WealthStatementForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    formState: { errors } 
  } = useForm({
    defaultValues: getStepData('wealth')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate wealth totals
  const calculateWealthTotals = (values) => {
    // Assets - Previous Year
    const assetsPrevious = [
      'property_previous_year',
      'investment_previous_year',
      'vehicle_previous_year',
      'jewelry_previous_year',
      'cash_previous_year',
      'pf_previous_year',
      'bank_balance_previous_year',
      'other_assets_previous_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Assets - Current Year
    const assetsCurrent = [
      'property_current_year',
      'investment_current_year',
      'vehicle_current_year',
      'jewelry_current_year',
      'cash_current_year',
      'pf_current_year',
      'bank_balance_current_year',
      'other_assets_current_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Liabilities - Previous Year
    const liabilitiesPrevious = [
      'loan_previous_year',
      'other_liabilities_previous_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Liabilities - Current Year
    const liabilitiesCurrent = [
      'loan_current_year',
      'other_liabilities_current_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Net Worth
    const netWorthPrevious = assetsPrevious - liabilitiesPrevious;
    const netWorthCurrent = assetsCurrent - liabilitiesCurrent;
    const netWorthIncrease = netWorthCurrent - netWorthPrevious;

    return {
      assetsPrevious,
      assetsCurrent,
      liabilitiesPrevious,
      liabilitiesCurrent,
      netWorthPrevious,
      netWorthCurrent,
      netWorthIncrease
    };
  };

  const totals = calculateWealthTotals(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_assets_previous_year: totals.assetsPrevious,
      total_assets_current_year: totals.assetsCurrent,
      total_liabilities_previous_year: totals.liabilitiesPrevious,
      total_liabilities_current_year: totals.liabilitiesCurrent
    };

    const success = await saveFormStep('wealth', formData, true);
    if (success) {
      toast.success('Wealth statement completed successfully');
      navigate('/tax-forms/wealth-reconciliation');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_assets_previous_year: totals.assetsPrevious,
      total_assets_current_year: totals.assetsCurrent,
      total_liabilities_previous_year: totals.liabilitiesPrevious,
      total_liabilities_current_year: totals.liabilitiesCurrent
    };

    const success = await saveFormStep('wealth', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/wealth-reconciliation');
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
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Gem className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wealth Statement</h1>
              <p className="text-gray-600">Enter your assets, liabilities, and wealth reconciliation</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Wealth Statement Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Required for income reconciliation under Pakistani tax law</li>
              <li>• Include market value of all assets as of June 30th</li>
              <li>• Previous year = June 30, 2024; Current year = June 30, 2025</li>
              <li>• Include all bank accounts, investments, property, vehicles</li>
              <li>• Declare all liabilities including loans and mortgages</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Assets Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Assets
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Asset Type</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Previous Year (PKR)</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Current Year (PKR)</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Change</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {[
                  { key: 'property', label: 'Immovable Property', icon: Home },
                  { key: 'investment', label: 'Investments/Securities', icon: TrendingUp },
                  { key: 'vehicle', label: 'Motor Vehicles', icon: Car },
                  { key: 'jewelry', label: 'Jewelry/Valuables', icon: Gem },
                  { key: 'cash', label: 'Cash in Hand', icon: DollarSign },
                  { key: 'pf', label: 'Provident Fund', icon: Briefcase },
                  { key: 'bank_balance', label: 'Bank Balances', icon: CreditCard },
                  { key: 'other_assets', label: 'Other Assets', icon: Briefcase }
                ].map(({ key, label, icon: Icon }) => {
                  const prevValue = parseFloat(watchedValues[`${key}_previous_year`]) || 0;
                  const currValue = parseFloat(watchedValues[`${key}_current_year`]) || 0;
                  const change = currValue - prevValue;
                  
                  return (
                    <tr key={key} className="border-b border-green-100">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4 text-green-600" />
                          <span className="font-medium">{label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`${key}_previous_year`, {
                            min: { value: 0, message: 'Amount cannot be negative' }
                          })}
                          className={inputClasses}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`${key}_current_year`, {
                            min: { value: 0, message: 'Amount cannot be negative' }
                          })}
                          className={inputClasses}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change >= 0 ? '+' : ''}{formatCurrency(change)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Assets Total */}
          <div className="mt-4 p-4 bg-green-100 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-green-700 mb-1">Total Assets (Previous)</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(totals.assetsPrevious)}</p>
              </div>
              <div>
                <p className="text-sm text-green-700 mb-1">Total Assets (Current)</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(totals.assetsCurrent)}</p>
              </div>
              <div>
                <p className="text-sm text-green-700 mb-1">Net Change</p>
                <p className={`text-xl font-bold ${totals.assetsCurrent - totals.assetsPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.assetsCurrent - totals.assetsPrevious)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities Section */}
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-red-600" />
            Liabilities
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Liability Type</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Previous Year (PKR)</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Current Year (PKR)</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'loan', label: 'Loans/Mortgages', icon: CreditCard },
                  { key: 'other_liabilities', label: 'Other Liabilities', icon: Briefcase }
                ].map(({ key, label, icon: Icon }) => {
                  const prevValue = parseFloat(watchedValues[`${key}_previous_year`]) || 0;
                  const currValue = parseFloat(watchedValues[`${key}_current_year`]) || 0;
                  const change = currValue - prevValue;
                  
                  return (
                    <tr key={key} className="border-b border-red-100">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4 text-red-600" />
                          <span className="font-medium">{label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`${key}_previous_year`, {
                            min: { value: 0, message: 'Amount cannot be negative' }
                          })}
                          className={inputClasses}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`${key}_current_year`, {
                            min: { value: 0, message: 'Amount cannot be negative' }
                          })}
                          className={inputClasses}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-medium ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {change >= 0 ? '+' : ''}{formatCurrency(change)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Liabilities Total */}
          <div className="mt-4 p-4 bg-red-100 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-red-700 mb-1">Total Liabilities (Previous)</p>
                <p className="text-xl font-bold text-red-800">{formatCurrency(totals.liabilitiesPrevious)}</p>
              </div>
              <div>
                <p className="text-sm text-red-700 mb-1">Total Liabilities (Current)</p>
                <p className="text-xl font-bold text-red-800">{formatCurrency(totals.liabilitiesCurrent)}</p>
              </div>
              <div>
                <p className="text-sm text-red-700 mb-1">Net Change</p>
                <p className={`text-xl font-bold ${totals.liabilitiesCurrent - totals.liabilitiesPrevious >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(totals.liabilitiesCurrent - totals.liabilitiesPrevious)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Net Worth Summary */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-6">Net Worth Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-primary-700 mb-2">Net Worth (Previous Year)</p>
              <p className="text-2xl font-bold text-primary-900">{formatCurrency(totals.netWorthPrevious)}</p>
              <p className="text-xs text-gray-500 mt-1">As of June 30, 2024</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-primary-700 mb-2">Net Worth (Current Year)</p>
              <p className="text-2xl font-bold text-primary-900">{formatCurrency(totals.netWorthCurrent)}</p>
              <p className="text-xs text-gray-500 mt-1">As of June 30, 2025</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-primary-700 mb-2">Net Wealth Increase</p>
              <p className={`text-2xl font-bold ${totals.netWorthIncrease >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.netWorthIncrease)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Change during tax year</p>
            </div>
          </div>

          {/* Wealth Reconciliation Note */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Wealth Reconciliation</h4>
                <p className="text-sm text-blue-800">
                  The increase in net worth should be reconciled with your declared income and expenses. 
                  Significant unexplained increases may trigger tax authority scrutiny.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/expenses')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Expenses
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="flex items-center px-6 py-3 text-primary-600 bg-primary-100 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Next: Wealth Reconciliation'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default WealthStatementForm;