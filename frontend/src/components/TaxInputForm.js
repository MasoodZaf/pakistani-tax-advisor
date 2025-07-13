import React, { useState, useEffect } from 'react';
import { formatInputPKR, parsePKR, validatePKRAmount, formatPKR } from '../utils/currencyFormatter';
import { calculateTax } from '../services/taxService';
import './TaxInputForm.css';

const TaxInputForm = () => {
  // Form state
  const [formData, setFormData] = useState({
    income: '',
    taxType: 'salaried',
    isFiler: true
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [taxResult, setTaxResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // Input validation
  const validateForm = () => {
    const newErrors = {};
    
    // Validate income
    const incomeValidation = validatePKRAmount(formData.income, {
      required: true,
      min: 0,
      max: 100000000 // 100 million PKR max
    });
    
    if (!incomeValidation.isValid) {
      newErrors.income = incomeValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle income input change with formatting
  const handleIncomeChange = (e) => {
    const value = e.target.value;
    const formattedValue = formatInputPKR(value);
    
    setFormData(prev => ({
      ...prev,
      income: formattedValue
    }));

    // Clear income error when user starts typing
    if (errors.income) {
      setErrors(prev => ({
        ...prev,
        income: null
      }));
    }
  };

  // Handle other form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsCalculating(true);
    setShowResult(false);

    try {
      // Parse the formatted income back to number
      const numericIncome = parsePKR(formData.income);
      
      // Call the API
      const result = await calculateTax({
        income: numericIncome,
        taxType: formData.taxType,
        isFiler: formData.isFiler
      });

      setTaxResult(result);
      setShowResult(true);
      
    } catch (error) {
      setErrors({
        submit: error.message || 'Failed to calculate tax. Please try again.'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      income: '',
      taxType: 'salaried',
      isFiler: true
    });
    setErrors({});
    setTaxResult(null);
    setShowResult(false);
  };

  return (
    <div className="tax-input-form">
      <div className="form-header">
        <h2>🇵🇰 Tax Calculator</h2>
        <p>Calculate your Pakistani income tax for 2024-25</p>
      </div>

      <form onSubmit={handleSubmit} className="tax-form">
        {/* Income Input */}
        <div className="form-group">
          <label htmlFor="income" className="form-label">
            Annual Income <span className="required">*</span>
          </label>
          <div className="input-wrapper">
            <span className="currency-prefix">Rs.</span>
            <input
              type="text"
              id="income"
              name="income"
              value={formData.income}
              onChange={handleIncomeChange}
              placeholder="Enter your annual income"
              className={`form-input ${errors.income ? 'error' : ''}`}
              autoComplete="off"
            />
          </div>
          {errors.income && (
            <span className="error-message">{errors.income}</span>
          )}
          <small className="form-help">
            Enter your total annual income in Pakistani Rupees
          </small>
        </div>

        {/* Tax Type Selection */}
        <div className="form-group">
          <label className="form-label">Employment Type</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="taxType"
                value="salaried"
                checked={formData.taxType === 'salaried'}
                onChange={(e) => handleFieldChange('taxType', e.target.value)}
                className="radio-input"
              />
              <span className="radio-text">Salaried Employee</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="taxType"
                value="non-salaried"
                checked={formData.taxType === 'non-salaried'}
                onChange={(e) => handleFieldChange('taxType', e.target.value)}
                className="radio-input"
              />
              <span className="radio-text">Non-Salaried/Business</span>
            </label>
          </div>
        </div>

        {/* Filer Status */}
        <div className="form-group">
          <label className="form-label">Tax Filer Status</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="isFiler"
                value={true}
                checked={formData.isFiler === true}
                onChange={(e) => handleFieldChange('isFiler', true)}
                className="radio-input"
              />
              <span className="radio-text">Filer</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="isFiler"
                value={false}
                checked={formData.isFiler === false}
                onChange={(e) => handleFieldChange('isFiler', false)}
                className="radio-input"
              />
              <span className="radio-text">Non-Filer</span>
            </label>
          </div>
          <small className="form-help">
            Non-filers pay higher tax rates
          </small>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="error-message submit-error">
            {errors.submit}
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isCalculating}
            className="btn btn-primary"
          >
            {isCalculating ? (
              <>
                <span className="spinner"></span>
                Calculating...
              </>
            ) : (
              'Calculate Tax'
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Tax Result Display */}
      {showResult && taxResult && (
        <TaxResultDisplay result={taxResult} />
      )}
    </div>
  );
};

// Tax Result Display Component
const TaxResultDisplay = ({ result }) => {
  const {
    income,
    taxable_income,
    total_tax,
    net_income,
    effective_rate,
    slabs,
    additional_tax
  } = result;

  return (
    <div className="tax-result">
      <h3>Tax Calculation Result</h3>
      
      {/* Summary Cards */}
      <div className="result-summary">
        <div className="result-card">
          <h4>Total Income</h4>
          <p className="amount">{formatPKR(income)}</p>
        </div>
        <div className="result-card">
          <h4>Taxable Income</h4>
          <p className="amount">{formatPKR(taxable_income)}</p>
        </div>
        <div className="result-card highlight">
          <h4>Total Tax</h4>
          <p className="amount">{formatPKR(total_tax)}</p>
        </div>
        <div className="result-card">
          <h4>Net Income</h4>
          <p className="amount">{formatPKR(net_income)}</p>
        </div>
      </div>

      {/* Effective Tax Rate */}
      <div className="tax-rate">
        <h4>Effective Tax Rate: {effective_rate.toFixed(2)}%</h4>
      </div>

      {/* Tax Slabs Breakdown */}
      <div className="slabs-breakdown">
        <h4>Tax Slabs Breakdown</h4>
        <div className="slabs-table">
          <div className="table-header">
            <div>Income Range</div>
            <div>Rate</div>
            <div>Taxable Amount</div>
            <div>Tax</div>
          </div>
          {slabs.map((slab, index) => (
            <div key={index} className="table-row">
              <div className="slab-range">
                {formatPKR(slab.min)} - {slab.max ? formatPKR(slab.max) : 'Above'}
              </div>
              <div className="slab-rate">{slab.rate}%</div>
              <div className="slab-amount">{formatPKR(slab.taxable_amount)}</div>
              <div className="slab-tax">{formatPKR(slab.tax)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Tax Information */}
      {additional_tax > 0 && (
        <div className="additional-info">
          <h4>Additional Tax</h4>
          <p>Additional tax for high earners: {formatPKR(additional_tax)}</p>
        </div>
      )}
    </div>
  );
};

export default TaxInputForm; 