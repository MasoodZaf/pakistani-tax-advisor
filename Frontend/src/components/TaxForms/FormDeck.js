import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Circle } from 'lucide-react';
import { useTaxForm } from '../../contexts/TaxFormContext';

/**
 * Module-scoped deck of form cards. Mounted as the landing page for both the
 * Income Tax Forms module and the Wealth Statement module so each shows only
 * its own forms — Tax Computation Summary stays inside Income Tax, while
 * Wealth Statement / Reconciliation stay isolated to the wealth module.
 *
 * Card numbers are sequential within the deck (1..N) so each module reads
 * naturally on its own — Income Tax cards run 1..8 (or 1..10 if Capital Gains
 * and Final Tax are activated by addons), Wealth runs 1..2.
 */
const ROUTE_MAP = {
  income:                'income',
  final_min_income:      'final-min-income',
  adjustable_tax:        'adjustable-tax',
  reductions:            'reductions',
  credits:               'credits',
  deductions:            'deductions',
  final_tax:             'final-tax',
  capital_gain:          'capital-gains',
  expenses:              'expenses',
  tax_computation:       'tax-computation',
  wealth:                'wealth-statement',
  wealth_reconciliation: 'wealth-reconciliation',
};

const INCOME_TAX_STEP_IDS = [
  'income', 'final_min_income', 'adjustable_tax', 'reductions',
  'credits', 'deductions', 'final_tax', 'capital_gain', 'expenses', 'tax_computation',
];
const WEALTH_STEP_IDS = ['wealth', 'wealth_reconciliation'];

const STEP_BUCKET = {
  income:                'income-tax',
  final_min_income:      'income-tax',
  adjustable_tax:        'income-tax',
  reductions:            'income-tax',
  credits:               'income-tax',
  deductions:            'income-tax',
  final_tax:             'income-tax',
  capital_gain:          'income-tax',
  expenses:              'income-tax',
  tax_computation:       'income-tax',
  wealth:                'wealth-statement',
  wealth_reconciliation: 'wealth-statement',
};

const stepHref = (id) => {
  const path = ROUTE_MAP[id] || id;
  return `/${STEP_BUCKET[id] || 'income-tax'}/${path}`;
};

const FormDeck = ({ title, subtitle, scope }) => {
  const { FORM_STEPS, activeSteps, completedSteps } = useTaxForm();

  const allowedIds = scope === 'wealth' ? WEALTH_STEP_IDS : INCOME_TAX_STEP_IDS;
  const activeIds  = new Set((activeSteps || []).map((s) => s.id));

  // Show every form that belongs to this scope AND is active in the user's
  // current return profile. Number cards sequentially within the deck.
  const cards = FORM_STEPS
    .filter((step) => allowedIds.includes(step.id) && activeIds.has(step.id))
    .map((step, idx) => ({ step, idx }));

  // Find the next incomplete step inside this scope so we can highlight it.
  const nextStep = cards.find(({ step }) => !completedSteps.has(step.id))?.step;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <span className="text-sm text-gray-500">
            {cards.filter(({ step }) => completedSteps.has(step.id)).length} / {cards.length} completed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map(({ step, idx }) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent   = nextStep?.id === step.id;
            return (
              <Link
                key={step.id}
                to={stepHref(step.id)}
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
                      {idx + 1}
                    </div>
                    <span className="text-2xl" role="img" aria-label={step.title}>{step.icon}</span>
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted
                      ? <CheckCircle className="w-5 h-5 text-green-500" />
                      : <Circle className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                <div className="flex-grow">
                  <h3 className={`font-semibold mb-2 text-base leading-tight
                    ${isCompleted ? 'text-green-900' : isCurrent ? 'text-primary-900' : 'text-gray-900'}`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm leading-relaxed mb-3
                    ${isCompleted ? 'text-green-700' : isCurrent ? 'text-primary-700' : 'text-gray-600'}`}>
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
    </div>
  );
};

export default FormDeck;
