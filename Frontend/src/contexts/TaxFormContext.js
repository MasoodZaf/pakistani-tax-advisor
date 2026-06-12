import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useTaxYear } from './TaxYearContext';
import { isStaff } from '../utils/roles';

const TaxFormContext = createContext();

export const useTaxForm = () => {
  const context = useContext(TaxFormContext);
  if (!context) {
    throw new Error('useTaxForm must be used within a TaxFormProvider');
  }
  return context;
};

// Form step configuration
const FORM_STEPS = [
  {
    id: 'income',
    title: 'Normal Income',
    description: 'Primary income subject to normal taxation',
    icon: '💰',
    formType: 'income-form'
  },
  {
    id: 'final_min_income',
    title: 'Final/Min Tax Income',
    description: 'Income subject to final/fixed/minimum tax',
    icon: '🏛️',
    formType: 'final-min-income'
  },
  {
    id: 'adjustable_tax',
    title: 'Adjustable Tax',
    description: 'Withholding taxes and advance payments',
    icon: '📊',
    formType: 'adjustable-tax'
  },
  {
    id: 'reductions',
    title: 'Tax Reductions',
    description: 'Teacher, export, and other reductions',
    icon: '📉',
    formType: 'reductions'
  },
  {
    id: 'credits',
    title: 'Tax Credits',
    description: 'Charitable donations and investments',
    icon: '🎁',
    formType: 'credits'
  },
  {
    id: 'deductions',
    title: 'Tax Deductions',
    description: 'Advance tax and foreign tax credits',
    icon: '💳',
    formType: 'deductions'
  },
  {
    id: 'final_tax',
    title: 'Final Tax',
    description: 'Sukuk, bonds, and final tax items',
    icon: '🏦',
    formType: 'final-tax'
  },
  {
    id: 'capital_gain',
    title: 'Capital Gains',
    description: 'Property and securities transactions',
    icon: '🏘️',
    formType: 'capital-gains'
  },
  {
    id: 'expenses',
    title: 'Allowable Expenses',
    description: 'Business and professional expenses',
    icon: '📝',
    formType: 'expenses'
  },
  {
    id: 'wealth',
    title: 'Wealth Statement',
    description: 'Assets, liabilities, and wealth reconciliation',
    icon: '💎',
    formType: 'wealth_forms'
  },
  {
    id: 'wealth_reconciliation',
    title: 'Wealth Reconciliation',
    description: 'Critical FBR compliance - unreconciled difference must be zero',
    icon: '⚖️',
    formType: 'wealth_reconciliation_forms'
  },
  {
    id: 'tax_computation',
    title: 'Tax Computation Summary',
    description: 'Complete tax calculation and final summary',
    icon: '🧮',
    formType: 'tax-computation'
  }
];

// Steps that are always shown regardless of income profile
const ALWAYS_ACTIVE_STEP_IDS = new Set([
  'income', 'final_min_income', 'adjustable_tax', 'reductions',
  'credits', 'deductions', 'expenses', 'wealth', 'wealth_reconciliation', 'tax_computation',
]);

// Conditional steps — shown only when at least one listed addon is selected
const CONDITIONAL_STEP_ADDONS = {
  capital_gain: ['property_gain', 'securities'],
  final_tax:    ['bank_profit', 'dividends', 'securities', 'prizes'],
};

function deriveActiveSteps(formSteps, addons = []) {
  const addonSet = new Set(addons);
  return formSteps.filter(step => {
    if (ALWAYS_ACTIVE_STEP_IDS.has(step.id)) return true;
    const required = CONDITIONAL_STEP_ADDONS[step.id];
    return required && required.some(a => addonSet.has(a));
  });
}

// Default stream enabled when a consultant saves a conditional form the
// client's profile doesn't cover — keeps the phase-z5 completion denominator
// consistent with the data. The consultant can refine the stream in Settings.
const STEP_DEFAULT_ADDON = {
  capital_gain: 'property_gain',
  final_tax: 'bank_profit',
};

export const TaxFormProvider = ({ children }) => {
  const { user, loginPayload, clearLoginPayload } = useAuth();
  const { currentTaxYear } = useTaxYear();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [taxReturn, setTaxReturn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxCalculation, setTaxCalculation] = useState(null);
  const [incomeProfile, setIncomeProfile] = useState({ primary: 'salaried', addons: [] });

  // Load tax return when user authentication changes
  // Skip for staff users — they manage other users' returns, not their own
  const isAdmin = isStaff(user);

  // Consultant working a client's return via impersonation. Same flag the
  // ImpersonationBanner reads; impersonation sessions always start with a
  // fresh page load (token swap), so a render-time read is reliable.
  const isImpersonation = typeof window !== 'undefined'
    && localStorage.getItem('isImpersonation') === 'true';

  useEffect(() => {
    if (user && !isAdmin) {
      // Seed the tax return immediately from login payload so the dashboard
      // renders with real data while the full form fetch happens in the background
      if (loginPayload?.currentYearData) {
        const ly = loginPayload.currentYearData;
        setTaxReturn(ly);
        // Seed completion percentage from login data
        if (ly.completion_percentage != null) {
          const total = FORM_STEPS.length;
          const done  = Math.round((ly.completion_percentage / 100) * total);
          setCompletedSteps(new Set(FORM_STEPS.slice(0, done).map(s => s.id)));
        }
      }
      loadTaxReturn();
    } else {
      setFormData({});
      setCompletedSteps(new Set());
      setTaxReturn(null);
      setTaxCalculation(null);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTaxReturn = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tax-forms/current-return');

      if (response.data.taxReturn) {
        setTaxReturn(response.data.taxReturn);
        setFormData(response.data.formData || {});
        setCompletedSteps(new Set(response.data.completedSteps || []));
        if (response.data.taxReturn.income_profile) {
          setIncomeProfile(response.data.taxReturn.income_profile);
        }
      } else {
        await createNewTaxReturn();
      }
    } catch (error) {
      // Keep the seed data from loginPayload if the fetch fails
      if (!taxReturn) {
        setTaxReturn(null);
        setFormData({});
        setCompletedSteps(new Set());
      }
    } finally {
      setLoading(false);
      clearLoginPayload(); // release the seed data — real data is now loaded
    }
  };

  const updateIncomeProfile = async (addons) => {
    try {
      const response = await axios.post('/api/tax-forms/income-profile', {
        addons,
        taxYear: currentTaxYear,
      });
      if (response.data.success) {
        setIncomeProfile(response.data.income_profile);
      }
      return response.data.success;
    } catch {
      return false;
    }
  };

  const createNewTaxReturn = async () => {
    try {
      const response = await axios.post('/api/tax-forms/create-return');
      const newTaxReturn = response.data.taxReturn;
      setTaxReturn(newTaxReturn);
      setFormData({});
      setCompletedSteps(new Set());
      return newTaxReturn; // return object so callers can use it immediately
    } catch (error) {
      return null;
    }
  };

  const updateFormData = (stepId, data) => {
    setFormData(prev => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        ...data
      }
    }));
  };

  // Copy-forward from the prior-year archive. Staged into formData but NOT
  // auto-saved — user must open the form and click Save to persist.
  useEffect(() => {
    const handler = (event) => {
      const { step, values } = event.detail || {};
      if (!step || !values) return;
      updateFormData(step, values);
    };
    window.addEventListener('copyForwardFromArchive', handler);
    return () => window.removeEventListener('copyForwardFromArchive', handler);
  }, []);

  const saveFormStep = async (stepId, data, markComplete = false) => {
    const step = FORM_STEPS.find(s => s.id === stepId);
    if (!step) {
      toast.error('Invalid form step');
      return false;
    }

    // Resolve the tax return to use — may need to create one on first save
    let activeTaxReturn = taxReturn;
    if (step.formType !== 'income-form' && !activeTaxReturn) {
      activeTaxReturn = await createNewTaxReturn();
      if (!activeTaxReturn) {
        toast.error('Unable to create tax return. Please try again.');
        return false;
      }
    }

    try {
      setSaving(true);

      let response;

      // Handle income form with the working income-form API
      if (step.formType === 'income-form') {
        // Don't save against a guessed year (FE-02) — bail if it hasn't loaded.
        if (!currentTaxYear) {
          toast.error('Tax year is still loading — please try again in a moment.');
          setSaving(false);
          return false;
        }
        response = await axios.post(`/api/income-form/${currentTaxYear}`, data);
      } else {
        response = await axios.post(`/api/tax-forms/${step.formType}`, {
          taxReturnId: activeTaxReturn.id,
          ...data,
          isComplete: markComplete
        });
      }

      // Update local form data — prefer response data (contains DB-computed columns like
      // total_adjustable_tax, net_worth_current_year etc.) over the raw sent payload.
      const responseData = response.data?.data || response.data?.formData;
      updateFormData(stepId, responseData || data);

      if (markComplete) {
        setCompletedSteps(prev => new Set([...prev, stepId]));
      }

      // Consultant mode (impersonation): saving a conditional form the client's
      // income profile doesn't cover auto-enables the matching stream, so the
      // profile, the saved data, and the completion % stay consistent.
      if (isImpersonation && CONDITIONAL_STEP_ADDONS[stepId]) {
        const addons = incomeProfile?.addons || [];
        if (!CONDITIONAL_STEP_ADDONS[stepId].some(a => addons.includes(a))) {
          const ok = await updateIncomeProfile([...addons, STEP_DEFAULT_ADDON[stepId]]);
          if (ok) {
            toast(`Enabled the matching income stream on the client's profile so this form counts toward completion. Adjust it under Settings → Income streams if a different stream applies.`, { icon: 'ℹ️', duration: 6000 });
          }
        }
      }

      // Only show generic toast for non-income forms
      if (step.formType !== 'income-form') {
        toast.success('Form saved successfully');
      }
      return true;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save form';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const calculateTax = async () => {
    if (!taxReturn) {
      toast.error('No tax return found');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/tax-forms/calculate', {
        taxReturnId: taxReturn.id
      });

      setTaxCalculation(response.data.calculation);
      toast.success('Tax calculation completed');
      return response.data.calculation;
    } catch (error) {
      const message = error.response?.data?.message || 'Tax calculation failed';
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Pulls the structured readiness punch list from the backend. The server
  // re-runs the same checks at submit time, so this call is purely advisory.
  const getReadinessReport = async (taxYear) => {
    try {
      const year = taxYear || taxReturn?.tax_year;
      if (!year) return null;
      const res = await axios.get(`/api/tax-forms/readiness/${encodeURIComponent(year)}`);
      return res?.data?.data || null;
    } catch (err) {
      // Don't fail the submit flow over a readiness fetch error — server
      // will enforce regardless.
      return null;
    }
  };

  const submitTaxReturn = async () => {
    if (!taxReturn) {
      toast.error('No tax return found');
      return { ok: false };
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/tax-forms/submit', {
        taxReturnId: taxReturn.id,
        taxYear: taxReturn.tax_year,
      });
      setTaxReturn(response.data.taxReturn);
      toast.success('Tax return submitted successfully');
      return { ok: true, readiness: response.data.readiness };
    } catch (error) {
      // 422 = readiness blocked the submit; surface the structured punch
      // list so the UI can render it inline. Anything else is a real
      // server error.
      if (error.response?.status === 422 && error.response.data?.readiness) {
        toast.error(error.response.data.message || 'Cannot submit — fix issues first');
        return { ok: false, readiness: error.response.data.readiness };
      }
      const message = error.response?.data?.message || 'Submission failed';
      toast.error(message);
      return { ok: false };
    } finally {
      setLoading(false);
    }
  };

  const goToStep = (stepIndex) => {
    if (stepIndex >= 0 && stepIndex < FORM_STEPS.length) {
      setCurrentStep(stepIndex);
    }
  };

  const nextStep = () => {
    if (currentStep < FORM_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepData = (stepId) => {
    return formData[stepId] || {};
  };

  const isStepCompleted = (stepId) => {
    return completedSteps.has(stepId);
  };

  // Active steps = always-shown + conditionally unlocked by selected addons
  const activeSteps = deriveActiveSteps(FORM_STEPS, incomeProfile.addons);

  // What navigation should show. For the client themselves this is exactly
  // activeSteps. A consultant impersonating the client sees ALL forms — they
  // often know about income sources the client didn't pick at onboarding —
  // with the out-of-profile ones flagged so the UI can mark them. Progress
  // math stays on activeSteps (matches the backend phase-z5 denominator).
  const activeStepIds = new Set(activeSteps.map(s => s.id));
  const visibleSteps = isImpersonation
    ? FORM_STEPS.map(s => (activeStepIds.has(s.id) ? s : { ...s, inactiveForProfile: true }))
    : activeSteps;

  const getCompletionPercentage = () => {
    const activeCompleted = activeSteps.filter(s => completedSteps.has(s.id)).length;
    return activeSteps.length > 0 ? Math.round((activeCompleted / activeSteps.length) * 100) : 0;
  };

  const value = {
    // Form configuration
    FORM_STEPS,
    activeSteps,       // filtered by income profile — use this for progress math
    visibleSteps,      // what navigation renders; = activeSteps unless impersonating (then all, flagged)
    isImpersonation,   // consultant working this return via impersonation
    incomeProfile,

    // Current state
    currentStep,
    formData,
    completedSteps,
    taxReturn,
    loading,
    saving,
    taxCalculation,

    // Navigation
    goToStep,
    nextStep,
    previousStep,

    // Data management
    updateFormData,
    saveFormStep,
    getStepData,
    isStepCompleted,
    getCompletionPercentage,
    updateIncomeProfile,

    // Tax operations
    calculateTax,
    submitTaxReturn,
    getReadinessReport,
    loadTaxReturn,
    createNewTaxReturn,
  };

  return (
    <TaxFormContext.Provider value={value}>
      {children}
    </TaxFormContext.Provider>
  );
};