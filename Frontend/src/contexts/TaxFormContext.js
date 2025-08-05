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
    title: 'Income Information',
    description: 'Salary, bonuses, and other income sources',
    icon: '💰',
    formType: 'income_forms'
  },
  {
    id: 'adjustable_tax',
    title: 'Adjustable Tax',
    description: 'Withholding taxes and advance payments',
    icon: '📊',
    formType: 'adjustable_tax_forms'
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
        // Create new tax return
        await createNewTaxReturn();
      }
    } catch (error) {
      console.error('Error loading tax return:', error);
      // Create new tax return if none exists
      await createNewTaxReturn();
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
      toast.success('New tax return created');
    } catch (error) {
      console.error('Error creating tax return:', error);
      toast.error('Failed to create tax return');
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
    if (!taxReturn) {
      toast.error('No tax return found. Please refresh the page.');
      return false;
    }

    try {
      setSaving(true);
      
      const step = FORM_STEPS.find(s => s.id === stepId);
      if (!step) {
        throw new Error('Invalid step ID');
      }

      const response = await axios.post(`/api/tax-forms/${step.formType}`, {
        taxReturnId: taxReturn.id,
        ...data,
        isComplete: markComplete
      });

      // Update local form data
      updateFormData(stepId, data);

      if (markComplete) {
        setCompletedSteps(prev => new Set([...prev, stepId]));
      }

      toast.success('Form saved successfully');
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