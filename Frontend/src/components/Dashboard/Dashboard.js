import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { taxReturn, getCompletionPercentage, FORM_STEPS, completedSteps, taxCalculation, formData } = useTaxForm();

  const completionPercentage = getCompletionPercentage();
  const completedCount = completedSteps.size;
  const totalSteps = FORM_STEPS.length;

  // Calculate real tax values from form data
  const getTaxDueAmount = () => {
    if (taxCalculation) {
      const additionalTax = taxCalculation.additional_tax_due || 0;
      const refund = taxCalculation.refund_due || 0;
      
      if (additionalTax > 0) {
        return `PKR ${additionalTax.toLocaleString()}`;
      } else if (refund > 0) {
        return `PKR -${refund.toLocaleString()}`;
      } else {
        return 'PKR 0';
      }
    }
    
    // Fallback to income form data if available
    if (formData?.income) {
      const income = formData.income;
      const taxableIncome = parseFloat(income.total_taxable_income || 0);
      const taxPaid = parseFloat(income.salary_tax_deducted || 0);
      
      if (taxableIncome > 0) {
        // Basic tax calculation
        let tax = 0;
        if (taxableIncome <= 600000) {
          tax = 0;
        } else if (taxableIncome <= 1200000) {
          tax = (taxableIncome - 600000) * 0.025;
        } else if (taxableIncome <= 2200000) {
          tax = 15000 + (taxableIncome - 1200000) * 0.125;
        } else if (taxableIncome <= 3200000) {
          tax = 140000 + (taxableIncome - 2200000) * 0.20;
        } else if (taxableIncome <= 4100000) {
          tax = 340000 + (taxableIncome - 3200000) * 0.25;
        } else {
          tax = 565000 + (taxableIncome - 4100000) * 0.35;
        }
        
        const netTax = Math.round(tax) - taxPaid;
        if (netTax > 0) {
          return `PKR ${netTax.toLocaleString()}`;
        } else if (netTax < 0) {
          return `PKR -${Math.abs(netTax).toLocaleString()}`;
        }
      }
    }
    
    return 'PKR 0';
  };

  const getTaxDueSubtitle = () => {
    if (taxCalculation) {
      const additionalTax = taxCalculation.additional_tax_due || 0;
      const refund = taxCalculation.refund_due || 0;
      
      if (additionalTax > 0) {
        return 'Additional tax due';
      } else if (refund > 0) {
        return 'Refund due';
      } else {
        return 'No additional tax';
      }
    }
    
    if (completionPercentage < 100) {
      return 'Complete forms to calculate';
    }
    
    return 'Calculation pending';
  };

  const getReturnStatus = () => {
    if (taxReturn?.filing_status) {
      const status = taxReturn.filing_status.charAt(0).toUpperCase() + taxReturn.filing_status.slice(1);
      return status;
    }
    return 'Draft';
  };

  const getReturnSubtitle = () => {
    if (taxReturn?.filing_status === 'submitted') {
      return 'Successfully submitted';
    } else if (taxReturn?.filing_status === 'draft') {
      return 'Not yet submitted';
    }
    return 'Not yet submitted';
  };

  // Real data for dashboard
  const stats = [
    {
      title: 'Tax Return Progress',
      value: `${completionPercentage}%`,
      subtitle: `${completedCount}/${totalSteps} sections completed`,
      icon: FileText,
      color: 'blue',
      link: '/tax-forms'
    },
    {
      title: 'Estimated Tax Due',
      value: getTaxDueAmount(),
      subtitle: getTaxDueSubtitle(),
      icon: BarChart3,
      color: getTaxDueAmount().includes('-') ? 'green' : 'red',
      link: '/tax-forms'
    },
    {
      title: 'Filing Deadline',
      value: 'Sep 30, 2025',
      subtitle: 'Tax Year 2025-26',
      icon: Calendar,
      color: 'orange',
      link: '/tax-forms'
    },
    {
      title: 'Return Status',
      value: getReturnStatus(),
      subtitle: getReturnSubtitle(),
      icon: CheckCircle,
      color: taxReturn?.filing_status === 'submitted' ? 'green' : 'purple',
      link: '/tax-forms'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      red: 'bg-red-50 text-red-600 border-red-200',
      orange: 'bg-orange-50 text-orange-600 border-orange-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-gray-600 mt-1">
              Tax Year 2025-26 • Pakistani Tax Advisory System
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Your Role</div>
            <div className="font-medium text-gray-900 capitalize">
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={index}
              to={stat.link}
              className={`
                block p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-md
                ${getColorClasses(stat.color)}
              `}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{stat.title}</h3>
              <p className="text-sm text-gray-600">{stat.subtitle}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tax Return Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Return Progress</h2>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Overall Progress</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Recent Steps */}
          <div className="space-y-3">
            {FORM_STEPS.slice(0, 3).map((step) => {
              const isCompleted = completedSteps.has(step.id);
              return (
                <div key={step.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg">{step.icon}</div>
                    <div>
                      <div className="font-medium text-gray-900">{step.title}</div>
                      <div className="text-sm text-gray-600">{step.description}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <Link
              to="/tax-forms"
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors text-center block"
            >
              Continue Tax Return
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
          
          <div className="space-y-3">
            <Link
              to="/tax-forms"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-5 h-5 text-primary-600" />
              <div>
                <div className="font-medium text-gray-900">Tax Forms</div>
                <div className="text-sm text-gray-600">Complete your tax return</div>
              </div>
            </Link>
            
            <Link
              to="/reports"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Reports</div>
                <div className="text-sm text-gray-600">View tax calculations and reports</div>
              </div>
            </Link>
            
            <Link
              to="/settings"
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Settings</div>
                <div className="text-sm text-gray-600">Manage your account settings</div>
              </div>
            </Link>

            {['admin', 'super_admin'].includes(user?.role) && (
              <Link
                to="/admin"
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">Admin Panel</div>
                  <div className="text-sm text-gray-600">System administration</div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Important Notices */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Important Reminders</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Tax return filing deadline: September 30, 2025</li>
              <li>• Ensure all supporting documents are available</li>
              <li>• Review all information carefully before submission</li>
              <li>• Keep backup copies of your submitted return</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;