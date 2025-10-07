import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import {
  Home,
  FileText,
  BarChart3,
  Settings,
  Users,
  Shield,
  Calculator,
  TrendingUp,
  CheckCircle,
  Circle,
  FileSpreadsheet
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { FORM_STEPS, completedSteps, getCompletionPercentage } = useTaxForm();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
    },
    {
      name: 'Forms Overview',
      href: '/tax-forms',
      icon: FileText,
    },
    {
      name: 'Income Tax',
      href: '/income-tax',
      icon: Calculator,
    },
    {
      name: 'Wealth Statement',
      href: '/wealth-statement',
      icon: TrendingUp,
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
    },
    {
      name: 'Excel Import/Export',
      href: '/excel',
      icon: FileSpreadsheet,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  // Add admin navigation items
  if (['admin', 'super_admin'].includes(user?.role)) {
    navigation.splice(-1, 0, {
      name: 'Admin Panel',
      href: '/admin',
      icon: Shield,
    });
    
    if (user?.role === 'super_admin') {
      navigation.splice(-1, 0, {
        name: 'User Management',
        href: '/admin/users',
        icon: Users,
      });
    }
  }

  const isActive = (href) => {
    if (href === '/tax-forms') {
      return location.pathname.startsWith('/tax-forms');
    }
    if (href === '/income-tax') {
      return location.pathname.startsWith('/income-tax');
    }
    if (href === '/wealth-statement') {
      return location.pathname.startsWith('/wealth-statement');
    }
    if (href === '/admin') {
      return location.pathname.startsWith('/admin');
    }
    return location.pathname === href;
  };

  return (
    <div className="fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-6">
        {/* Navigation Menu */}
        <nav className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Tax Form Progress */}
        {location.pathname.startsWith('/tax-forms') && (
          <div className="mt-8">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Form Progress</h3>
                <span className="text-xs text-gray-500">{getCompletionPercentage()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getCompletionPercentage()}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-1">
              {FORM_STEPS.map((step, index) => {
                const isCompleted = completedSteps.has(step.id);
                const isCurrent = location.pathname.includes(step.id);
                
                return (
                  <Link
                    key={step.id}
                    to={`/tax-forms/${step.id}`}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-md text-xs transition-colors
                      ${isCurrent
                        ? 'bg-primary-50 text-primary-700'
                        : isCompleted
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                      }
                    `}
                  >
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{step.title}</p>
                      <p className="text-xs opacity-75 truncate">{step.description}</p>
                    </div>
                    <span className="text-lg">{step.icon}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
              <Calculator className="w-4 h-4" />
              <span>Tax Calculator</span>
            </button>
            <button className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
              <TrendingUp className="w-4 h-4" />
              <span>Tax Summary</span>
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h4>
          <p className="text-xs text-gray-600 mb-3">
            Contact our tax experts for assistance with your return.
          </p>
          <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            Get Support →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;