import React, { createContext, useContext, useState, useCallback } from 'react';
import taxFormService from '../services/taxFormService';
import { useNotification } from './NotificationContext';

const TaxFormContext = createContext(null);

export const useTaxForm = () => {
  const context = useContext(TaxFormContext);
  if (!context) {
    throw new Error('useTaxForm must be used within a TaxFormProvider');
  }
  return context;
};

export const TaxFormProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taxYears, setTaxYears] = useState([]);
  const [employers, setEmployers] = useState([]);
  const [completionStatus, setCompletionStatus] = useState({});
  const { showNotification } = useNotification();

  // Load tax years
  const loadTaxYears = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await taxFormService.getTaxYears();
      if (response?.data?.success && Array.isArray(response.data.data)) {
        setTaxYears(response.data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err.message);
      showNotification('Failed to load tax years', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Load employers
  const loadEmployers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await taxFormService.getEmployers();
      if (response?.data?.success && Array.isArray(response.data.data)) {
        setEmployers(response.data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err.message);
      showNotification('Failed to load employers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Load form completion status
  const loadCompletionStatus = useCallback(async (taxYearId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await taxFormService.getFormCompletionStatus(taxYearId);
      if (response?.data?.success && response.data.data) {
        setCompletionStatus(response.data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err.message);
      showNotification('Failed to load form completion status', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Generic save form function
  const saveForm = useCallback(async (formType, data, id = null) => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      const isUpdate = !!id;
      
      if (isUpdate) {
        // Update existing form
        switch (formType) {
          case 'income':
            response = await taxFormService.updateIncomeForm(id, data);
            break;
          case 'adjustable-tax':
            response = await taxFormService.updateAdjustableTaxForm(id, data);
            break;
          case 'reductions':
            response = await taxFormService.updateReductionsForm(id, data);
            break;
          case 'credits':
            response = await taxFormService.updateCreditsForm(id, data);
            break;
          case 'deductions':
            response = await taxFormService.updateDeductionsForm(id, data);
            break;
          case 'final-tax':
            response = await taxFormService.updateFinalTaxForm(id, data);
            break;
          case 'capital-gains':
            response = await taxFormService.updateCapitalGainsForm(id, data);
            break;
          case 'expenses':
            response = await taxFormService.updateExpensesForm(id, data);
            break;
          case 'wealth':
            response = await taxFormService.updateWealthForm(id, data);
            break;
          default:
            throw new Error('Invalid form type');
        }
      } else {
        // Create new form
        switch (formType) {
          case 'income':
            response = await taxFormService.saveIncomeForm(data);
            break;
          case 'adjustable-tax':
            response = await taxFormService.saveAdjustableTaxForm(data);
            break;
          case 'reductions':
            response = await taxFormService.saveReductionsForm(data);
            break;
          case 'credits':
            response = await taxFormService.saveCreditsForm(data);
            break;
          case 'deductions':
            response = await taxFormService.saveDeductionsForm(data);
            break;
          case 'final-tax':
            response = await taxFormService.saveFinalTaxForm(data);
            break;
          case 'capital-gains':
            response = await taxFormService.saveCapitalGainsForm(data);
            break;
          case 'expenses':
            response = await taxFormService.saveExpensesForm(data);
            break;
          case 'wealth':
            response = await taxFormService.saveWealthForm(data);
            break;
          default:
            throw new Error('Invalid form type');
        }
      }

      if (!response?.data?.success || !response.data.data) {
        throw new Error('Invalid response format');
      }

      // Update completion status
      await taxFormService.updateFormCompletionStatus(
        data.tax_year_id,
        formType,
        'completed'
      );

      // Show success notification
      const formName = formType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      showNotification(
        `${formName} form ${isUpdate ? 'updated' : 'saved'} successfully`,
        'success'
      );

      return response.data.data;
    } catch (err) {
      setError(err.message);
      showNotification(
        err.response?.data?.message || 'Failed to save form. Please try again.',
        'error'
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Generic load form function
  const loadForm = useCallback(async (formType, id) => {
    try {
      setLoading(true);
      setError(null);

      let response;
      switch (formType) {
        case 'income':
          response = await taxFormService.getIncomeForm(id);
          break;
        case 'adjustable-tax':
          response = await taxFormService.getAdjustableTaxForm(id);
          break;
        case 'reductions':
          response = await taxFormService.getReductionsForm(id);
          break;
        case 'credits':
          response = await taxFormService.getCreditsForm(id);
          break;
        case 'deductions':
          response = await taxFormService.getDeductionsForm(id);
          break;
        case 'final-tax':
          response = await taxFormService.getFinalTaxForm(id);
          break;
        case 'capital-gains':
          response = await taxFormService.getCapitalGainsForm(id);
          break;
        case 'expenses':
          response = await taxFormService.getExpensesForm(id);
          break;
        case 'wealth':
          response = await taxFormService.getWealthForm(id);
          break;
        default:
          throw new Error('Invalid form type');
      }

      if (!response?.data?.success || !response.data.data) {
        throw new Error('Invalid response format');
      }

      return response.data.data;
    } catch (err) {
      setError(err.message);
      showNotification('Failed to load form data', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const value = {
    loading,
    error,
    taxYears,
    employers,
    completionStatus,
    loadTaxYears,
    loadEmployers,
    loadCompletionStatus,
    saveForm,
    loadForm,
  };

  return (
    <TaxFormContext.Provider value={value}>
      {children}
    </TaxFormContext.Provider>
  );
};

export default TaxFormContext; 