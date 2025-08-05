import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  TrendingDown,
  GraduationCap,
  Building,
  Truck,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const ReductionsForm = () => {
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
    defaultValues: getStepData('reductions')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate total reductions
  const calculateTotal = (values) => {
    return [
      'teacher_reduction',
      'behbood_reduction',
      'export_income_reduction',
      'industrial_undertaking_reduction',
      'other_reductions'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalReductions = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_reductions: totalReductions
    };

    const success = await saveFormStep('reductions', formData, true);
    if (success) {
      toast.success('Tax reductions information saved successfully');
      navigate('/tax-forms/credits');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_reductions: totalReductions
    };

    const success = await saveFormStep('reductions', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/credits');
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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Reductions</h1>
              <p className="text-gray-600">Enter eligible tax reductions to reduce your taxable income</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Tax Reductions Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Teacher allowance: Special reduction for registered teachers</li>
              <li>• Behbood schemes: Contributions to approved Behbood funds</li>
              <li>• Export income: Special reductions for export-oriented businesses</li>
              <li>• Industrial undertaking: Reductions for qualified industrial projects</li>
              <li>• These reductions directly reduce your taxable income</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Teacher Reduction Section */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <GraduationCap className="w-5 h-5 mr-2 text-blue-600" />
            Teacher Allowance & Reduction
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Teacher Allowance Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('teacher_amount', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-blue-600">For registered teachers with NTN</p>
              {errors.teacher_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.teacher_amount.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Teacher Reduction (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('teacher_reduction', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.teacher_reduction && (
                <p className="mt-1 text-sm text-red-600">{errors.teacher_reduction.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Behbood Reduction Section */}
        <div className="bg-purple-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Building className="w-5 h-5 mr-2 text-purple-600" />
            Behbood Scheme Reduction
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Behbood Reduction (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('behbood_reduction', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-purple-600">Contributions to approved Behbood funds</p>
              {errors.behbood_reduction && (
                <p className="mt-1 text-sm text-red-600">{errors.behbood_reduction.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Export & Industrial Reduction Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-yellow-600" />
            Export & Industrial Reductions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Export Income Reduction (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('export_income_reduction', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-yellow-600">Special reductions for export income</p>
              {errors.export_income_reduction && (
                <p className="mt-1 text-sm text-red-600">{errors.export_income_reduction.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Industrial Undertaking Reduction (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('industrial_undertaking_reduction', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-yellow-600">Reductions for qualified industrial projects</p>
              {errors.industrial_undertaking_reduction && (
                <p className="mt-1 text-sm text-red-600">{errors.industrial_undertaking_reduction.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Other Reductions Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Other Reductions
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Other Reductions (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_reductions', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-600">Any other eligible tax reductions</p>
              {errors.other_reductions && (
                <p className="mt-1 text-sm text-red-600">{errors.other_reductions.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Tax Reductions Summary</h2>
          <div className="text-center">
            <p className="text-sm text-primary-700 mb-2">Total Tax Reductions</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReductions)}</p>
            <p className="text-xs text-primary-600 mt-1">This amount reduces your taxable income</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/adjustable_tax')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Adjustable Tax
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

export default ReductionsForm;