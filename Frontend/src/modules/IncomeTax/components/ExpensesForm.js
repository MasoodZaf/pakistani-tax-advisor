import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Receipt,
  Home,
  Car,
  Zap,
  Heart,
  Settings,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const ExpensesForm = () => {
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
    defaultValues: getStepData('expenses')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate total expenses
  const calculateTotal = (values) => {
    return [
      'rent',
      'rates',
      'income_tax',
      'vehicle',
      'travelling',
      'electricity',
      'water',
      'gas',
      'telephone',
      'medical',
      'educational',
      'donations',
      'other_expenses',
      'entertainment',
      'maintenance'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalExpenses = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_expenses: totalExpenses
    };

    const success = await saveFormStep('expenses', formData, true);
    if (success) {
      toast.success('Expenses information saved successfully');
      navigate('/tax-forms/wealth');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_expenses: totalExpenses
    };

    const success = await saveFormStep('expenses', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/wealth');
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
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Allowable Expenses</h1>
              <p className="text-gray-600">Enter your annual living and professional expenses</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Allowable Expenses Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Record all legitimate business and professional expenses</li>
              <li>• Include household expenses for wealth reconciliation</li>
              <li>• Keep receipts and documentation for all expenses</li>
              <li>• Some expenses may be tax-deductible depending on your profession</li>
              <li>• Used for wealth statement reconciliation purposes</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Housing & Property Expenses */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Home className="w-5 h-5 mr-2 text-blue-600" />
            Housing & Property Expenses
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Rent (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('rent', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.rent && (
                <p className="mt-1 text-sm text-red-600">{errors.rent.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Property Rates/Taxes (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('rates', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.rates && (
                <p className="mt-1 text-sm text-red-600">{errors.rates.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Maintenance (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('maintenance', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.maintenance && (
                <p className="mt-1 text-sm text-red-600">{errors.maintenance.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Utilities */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-600" />
            Utilities
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className={labelClasses}>
                Electricity (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('electricity', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.electricity && (
                <p className="mt-1 text-sm text-red-600">{errors.electricity.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Water (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('water', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.water && (
                <p className="mt-1 text-sm text-red-600">{errors.water.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Gas (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('gas', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.gas && (
                <p className="mt-1 text-sm text-red-600">{errors.gas.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Telephone/Internet (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('telephone', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.telephone && (
                <p className="mt-1 text-sm text-red-600">{errors.telephone.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Transportation */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Car className="w-5 h-5 mr-2 text-green-600" />
            Transportation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Vehicle Expenses (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('vehicle', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">Fuel, maintenance, insurance</p>
              {errors.vehicle && (
                <p className="mt-1 text-sm text-red-600">{errors.vehicle.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Travel Expenses (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('travelling', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">Business and personal travel</p>
              {errors.travelling && (
                <p className="mt-1 text-sm text-red-600">{errors.travelling.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Personal & Family Expenses */}
        <div className="bg-pink-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Heart className="w-5 h-5 mr-2 text-pink-600" />
            Personal & Family Expenses
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Medical Expenses (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('medical', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.medical && (
                <p className="mt-1 text-sm text-red-600">{errors.medical.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Educational Expenses (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('educational', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.educational && (
                <p className="mt-1 text-sm text-red-600">{errors.educational.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Entertainment (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('entertainment', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.entertainment && (
                <p className="mt-1 text-sm text-red-600">{errors.entertainment.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tax & Other Expenses */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-gray-600" />
            Tax & Other Expenses
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Income Tax Paid (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('income_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.income_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.income_tax.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Charitable Donations (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('donations', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.donations && (
                <p className="mt-1 text-sm text-red-600">{errors.donations.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Other Expenses (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_expenses', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_expenses && (
                <p className="mt-1 text-sm text-red-600">{errors.other_expenses.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Total Expenses Summary</h2>
          <div className="text-center">
            <p className="text-sm text-primary-700 mb-2">Total Annual Expenses</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-primary-600 mt-1">
              Used for wealth statement reconciliation and tax planning
            </p>
          </div>

          {/* Expense Breakdown */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-600">Housing</p>
              <p className="font-semibold">
                {formatCurrency((parseFloat(watchedValues.rent) || 0) + 
                               (parseFloat(watchedValues.rates) || 0) + 
                               (parseFloat(watchedValues.maintenance) || 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Utilities</p>
              <p className="font-semibold">
                {formatCurrency((parseFloat(watchedValues.electricity) || 0) + 
                               (parseFloat(watchedValues.water) || 0) + 
                               (parseFloat(watchedValues.gas) || 0) + 
                               (parseFloat(watchedValues.telephone) || 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Transportation</p>
              <p className="font-semibold">
                {formatCurrency((parseFloat(watchedValues.vehicle) || 0) + 
                               (parseFloat(watchedValues.travelling) || 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Personal</p>
              <p className="font-semibold">
                {formatCurrency((parseFloat(watchedValues.medical) || 0) + 
                               (parseFloat(watchedValues.educational) || 0) + 
                               (parseFloat(watchedValues.entertainment) || 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/capital_gain')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Capital Gains
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
              className="flex items-center px-6 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Complete & Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ExpensesForm;