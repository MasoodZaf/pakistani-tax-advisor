import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

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
    formType: 'final_min_income_forms'
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
    formType: 'reductions_forms'
  },
  {
    id: 'credits',
    title: 'Tax Credits',
    description: 'Charitable donations and investments',
    icon: '🎁',
    formType: 'credits_forms'
  },
  {
    id: 'deductions',
    title: 'Tax Deductions',
    description: 'Advance tax and foreign tax credits',
    icon: '💳',
    formType: 'deductions_forms'
  },
  {
    id: 'final_tax',
    title: 'Final Tax',
    description: 'Sukuk, bonds, and final tax items',
    icon: '🏦',
    formType: 'final_tax_forms'
  },
  {
    id: 'capital_gain',
    title: 'Capital Gains',
    description: 'Property and securities transactions',
    icon: '🏘️',
    formType: 'capital_gain_forms'
  },
  {
    id: 'expenses',
    title: 'Allowable Expenses',
    description: 'Business and professional expenses',
    icon: '📝',
    formType: 'expenses_forms'
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
    formType: 'tax_computation_forms'
  }
];

export const TaxFormProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [taxReturn, setTaxReturn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxCalculation, setTaxCalculation] = useState(null);

  // Load tax return when user authentication changes
  useEffect(() => {
    if (user) {
      loadTaxReturn();
    } else {
      // Clear data when user logs out
      setFormData({});
      setCompletedSteps(new Set());
      setTaxReturn(null);
      setTaxCalculation(null);
    }
  }, [user]);

  const loadTaxReturn = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tax-forms/current-return');

      if (response.data.taxReturn) {
        setTaxReturn(response.data.taxReturn);
        setFormData(response.data.formData || {});
        setCompletedSteps(new Set(response.data.completedSteps || []));
      } else {
        // Create new tax return silently
        await createNewTaxReturn();
      }
    } catch (error) {
      console.warn('Tax return not available yet:', error.message);
      // Don't create new tax return automatically to avoid errors
      // The income form can work without it
      setTaxReturn(null);
      setFormData({});
      setCompletedSteps(new Set());
    } finally {
      setLoading(false);
    }
  };

  const createNewTaxReturn = async () => {
    try {
      const response = await axios.post('/api/tax-forms/create-return');
      setTaxReturn(response.data.taxReturn);
      setFormData({});
      setCompletedSteps(new Set());
      console.log('New tax return created successfully');
      return true;
    } catch (error) {
      console.warn('Could not create tax return:', error.message);
      return false;
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

  const saveFormStep = async (stepId, data, markComplete = false) => {
    // For income form, we don't need a tax return - it has its own API
    const step = FORM_STEPS.find(s => s.id === stepId);
    if (step && step.formType === 'income-form') {
      // Income form doesn't need tax return validation
    } else if (!taxReturn) {
      // Only show error for non-income forms
      console.warn('No tax return found for step:', stepId);
      // Try to create a tax return instead of showing error
      const created = await createNewTaxReturn();
      if (!created) {
        toast.error('Unable to create tax return. Please try again.');
        return false;
      }
    }

    try {
      setSaving(true);
      
      const step = FORM_STEPS.find(s => s.id === stepId);
      if (!step) {
        throw new Error('Invalid step ID');
      }

      let response;

      // Handle income form with the working income-form API
      if (step.formType === 'income-form') {
        response = await axios.post('/api/income-form/2025-26', data);
      } else {
        response = await axios.post(`/api/tax-forms/${step.formType}`, {
          taxReturnId: taxReturn.id,
          ...data,
          isComplete: markComplete
        });
      }

      // Update local form data
      updateFormData(stepId, data);

      if (markComplete) {
        setCompletedSteps(prev => new Set([...prev, stepId]));
      }

      // Only show generic toast for non-income forms
      if (step.formType !== 'income-form') {
        toast.success('Form saved successfully');
      }
      return true;
    } catch (error) {
      console.error('Error saving form:', error);
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
      console.error('Error calculating tax:', error);
      const message = error.response?.data?.message || 'Tax calculation failed';
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const submitTaxReturn = async () => {
    if (!taxReturn) {
      toast.error('No tax return found');
      return false;
    }

    try {
      setLoading(true);
      
      // Check if all required steps are completed
      const requiredSteps = ['income', 'wealth']; // Minimum required steps
      const missingSteps = requiredSteps.filter(step => !completedSteps.has(step));
      
      if (missingSteps.length > 0) {
        toast.error(`Please complete the following steps: ${missingSteps.join(', ')}`);
        return false;
      }

      const response = await axios.post('/api/tax-forms/submit', {
        taxReturnId: taxReturn.id
      });

      setTaxReturn(response.data.taxReturn);
      toast.success('Tax return submitted successfully');
      return true;
    } catch (error) {
      console.error('Error submitting tax return:', error);
      const message = error.response?.data?.message || 'Submission failed';
      toast.error(message);
      return false;
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

  const getCompletionPercentage = () => {
    return Math.round((completedSteps.size / FORM_STEPS.length) * 100);
  };

  const value = {
    // Form configuration
    FORM_STEPS,
    
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
    
    // Tax operations
    calculateTax,
    submitTaxReturn,
    loadTaxReturn,
    createNewTaxReturn,
  };

  return (
    <TaxFormContext.Provider value={value}>
      {children}
    </TaxFormContext.Provider>
  );
};