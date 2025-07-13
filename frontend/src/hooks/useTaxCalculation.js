import { useState, useCallback } from 'react';
import { calculateTax } from '../services/taxService';
import { parsePKR } from '../utils/currencyFormatter';

/**
 * Custom hook for managing tax calculation state and operations
 * @returns {object} - Tax calculation state and functions
 */
export const useTaxCalculation = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [taxResult, setTaxResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastCalculation, setLastCalculation] = useState(null);

  /**
   * Calculate tax based on form data
   * @param {object} formData - Form data containing income, taxType, and isFiler
   * @returns {Promise<object>} - Tax calculation result
   */
  const calculateTaxAsync = useCallback(async (formData) => {
    setIsCalculating(true);
    setError(null);
    setTaxResult(null);

    try {
      const numericIncome = typeof formData.income === 'string' 
        ? parsePKR(formData.income) 
        : formData.income;

      const calculationParams = {
        income: numericIncome,
        taxType: formData.taxType,
        isFiler: formData.isFiler
      };

      const result = await calculateTax(calculationParams);
      
      setTaxResult(result);
      setLastCalculation({
        ...calculationParams,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to calculate tax. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCalculating(false);
    }
  }, []);

  /**
   * Reset the calculation state
   */
  const resetCalculation = useCallback(() => {
    setTaxResult(null);
    setError(null);
    setIsCalculating(false);
    setLastCalculation(null);
  }, []);

  /**
   * Clear only the error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Get a summary of the calculation
   * @returns {object|null} - Calculation summary or null if no calculation
   */
  const getCalculationSummary = useCallback(() => {
    if (!taxResult) return null;

    return {
      totalIncome: taxResult.income,
      totalTax: taxResult.total_tax,
      netIncome: taxResult.net_income,
      effectiveRate: taxResult.effective_rate,
      taxType: lastCalculation?.taxType,
      isFiler: lastCalculation?.isFiler,
      calculatedAt: lastCalculation?.timestamp
    };
  }, [taxResult, lastCalculation]);

  /**
   * Check if the current form data would trigger a new calculation
   * @param {object} formData - Current form data
   * @returns {boolean} - Whether calculation is needed
   */
  const needsRecalculation = useCallback((formData) => {
    if (!lastCalculation) return true;

    const numericIncome = typeof formData.income === 'string' 
      ? parsePKR(formData.income) 
      : formData.income;

    return (
      numericIncome !== lastCalculation.income ||
      formData.taxType !== lastCalculation.taxType ||
      formData.isFiler !== lastCalculation.isFiler
    );
  }, [lastCalculation]);

  return {
    // State
    isCalculating,
    taxResult,
    error,
    lastCalculation,
    
    // Actions
    calculateTax: calculateTaxAsync,
    resetCalculation,
    clearError,
    
    // Computed values
    hasResult: !!taxResult,
    hasError: !!error,
    
    // Utilities
    getCalculationSummary,
    needsRecalculation
  };
};

export default useTaxCalculation; 