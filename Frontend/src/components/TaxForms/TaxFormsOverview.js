import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { 
  FileText, 
  CheckCircle, 
  Circle, 
  Play, 
  BarChart3,
  Clock,
  User,
  Calendar
} from 'lucide-react';

const TaxFormsOverview = () => {
  const navigate = useNavigate();
  const { 
    FORM_STEPS, 
    completedSteps, 
    getCompletionPercentage, 
    taxReturn,
    calculateTax,
    submitTaxReturn,
    loading 
  } = useTaxForm();

  const handleStartForm = () => {
    navigate('/income-tax/income');
  };

  const handleCalculateTax = async () => {
    await calculateTax();
  };

  const handleSubmitReturn = async () => {
    const success = await submitTaxReturn();
    if (success) {
      // Redirect to confirmation or summary page
      navigate('/dashboard');
    }
  };

  const getNextIncompleteStep = () => {
    return FORM_STEPS.find(step => !completedSteps.has(step.id));
  };

  const nextStep = getNextIncompleteStep();
  const completionPercentage = getCompletionPercentage();
  const allStepsCompleted = completionPercentage === 100;

  // Map step ID to route path with modular structure
  const getRoutePath = (stepId) => {
    // Income Tax Module routes
    const incomeTaxSteps = [
      'income', 'adjustable_tax', 'final_min_income', 'capital_gains',
      'reductions', 'credits', 'deductions', 'final_tax', 'expenses', 'tax_computation'
    ];

    // Wealth Statement Module routes
    const wealthSteps = ['wealth', 'wealth_reconciliation'];

    // Admin Module routes
    const adminSteps = ['admin'];

    // Route mapping for special cases
    const routeMap = {
      'final_min_income': 'final-min-income',
      'adjustable_tax': 'adjustable-tax',
      'capital_gains': 'capital-gains',
      'tax_computation': 'tax-computation',
      'wealth_reconciliation': 'wealth-reconciliation'
    };

    const mappedStep = routeMap[stepId] || stepId;

    if (incomeTaxSteps.includes(stepId)) {
      return `/income-tax/${mappedStep}`;
    } else if (wealthSteps.includes(stepId)) {
      return `/wealth-statement/${mappedStep}`;
    } else if (adminSteps.includes(stepId)) {
      return `/admin/${mappedStep}`;
    }

    // Fallback to income tax module for unknown steps
    return `/income-tax/${mappedStep}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tax Return 2025-26</h1>
            <p className="text-gray-600">
              Complete your Pakistani tax return for the financial year 2024-25
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-600">{completionPercentage}%</div>
            <div className="text-sm text-gray-500">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Tax Return Info */}
        {taxReturn && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Return ID: {taxReturn.return_number}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Tax Year: {taxReturn.tax_year}</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Status: {taxReturn.filing_status}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Updated: {new Date(taxReturn.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col h-full">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {completionPercentage === 0 ? 'Start Tax Return' : 'Continue Tax Return'}
              </h3>
              <p className="text-sm text-gray-600">
                {nextStep ? `Next: ${nextStep.title}` : 'All sections completed'}
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <button
              onClick={nextStep ? () => navigate(getRoutePath(nextStep.id)) : handleStartForm}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              disabled={!nextStep && completionPercentage === 0}
            >
              {nextStep ? 'Continue' : completionPercentage === 0 ? 'Start Now' : 'Review Forms'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col h-full">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Calculate Tax</h3>
              <p className="text-sm text-gray-600">Calculate your tax liability</p>
            </div>
          </div>
          <div className="mt-auto">
            <button
              onClick={handleCalculateTax}
              disabled={completionPercentage < 50 || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Calculating...' : 'Calculate Tax'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col h-full">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tax Summary</h3>
              <p className="text-sm text-gray-600">View tax computation summary</p>
            </div>
          </div>
          <div className="mt-auto">
            <button
              onClick={() => navigate('/income-tax/tax-computation')}
              disabled={completionPercentage < 25}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
            >
              View Summary
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col h-full">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Submit Return</h3>
              <p className="text-sm text-gray-600">File your tax return</p>
            </div>
          </div>
          <div className="mt-auto">
            <button
              onClick={handleSubmitReturn}
              disabled={!allStepsCompleted || loading}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Submit Return'}
            </button>
          </div>
        </div>
      </div>

      {/* Form Steps Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Tax Return Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {FORM_STEPS.map((step, index) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = nextStep?.id === step.id;
            
            
            return (
              <Link
                key={step.id}
                to={getRoutePath(step.id)}
                className={`
                  flex flex-col p-5 rounded-lg border-2 transition-all duration-200 hover:shadow-md h-full
                  ${isCompleted 
                    ? 'border-green-200 bg-green-50 hover:border-green-300 hover:bg-green-100' 
                    : isCurrent 
                    ? 'border-primary-200 bg-primary-50 hover:border-primary-300 hover:bg-primary-100'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${isCompleted 
                        ? 'bg-green-100 text-green-800' 
                        : isCurrent 
                        ? 'bg-primary-100 text-primary-800'
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}>
                      {index + 1}
                    </div>
                    <span className="text-2xl" role="img" aria-label={step.title}>{step.icon}</span>
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                <div className="flex-grow">
                  <h3 className={`
                    font-semibold mb-2 text-base leading-tight
                    ${isCompleted 
                      ? 'text-green-900' 
                      : isCurrent 
                      ? 'text-primary-900'
                      : 'text-gray-900'
                    }
                  `}>
                    {step.title}
                  </h3>
                  
                  <p className={`
                    text-sm leading-relaxed mb-3
                    ${isCompleted 
                      ? 'text-green-700' 
                      : isCurrent 
                      ? 'text-primary-700'
                      : 'text-gray-600'
                    }
                  `}>
                    {step.description}
                  </p>
                </div>

                <div className="mt-auto pt-2">
                  {isCompleted && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Completed
                    </span>
                  )}

                  {isCurrent && !isCompleted && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      ⏳ In Progress
                    </span>
                  )}

                  {!isCompleted && !isCurrent && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      ○ Pending
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">Getting Started</h4>
            <ul className="space-y-1">
              <li>• Start with the Income section</li>
              <li>• Complete sections in order for best results</li>
              <li>• Save your progress at any time</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Important Notes</h4>
            <ul className="space-y-1">
              <li>• All amounts should be in Pakistani Rupees (PKR)</li>
              <li>• Keep supporting documents ready</li>
              <li>• Review all information before submission</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxFormsOverview;