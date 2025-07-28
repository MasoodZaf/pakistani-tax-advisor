import api from './api';

class TaxFormService {
  // Income Form
  async saveIncomeForm(data) {
    return api.post('/forms/income', data);
  }

  async updateIncomeForm(id, data) {
    return api.put(`/forms/income/${id}`, data);
  }

  async getIncomeForm(id) {
    return api.get(`/forms/income/${id}`);
  }

  // Adjustable Tax Form
  async saveAdjustableTaxForm(data) {
    return api.post('/forms/adjustable-tax', data);
  }

  async updateAdjustableTaxForm(id, data) {
    return api.put(`/forms/adjustable-tax/${id}`, data);
  }

  async getAdjustableTaxForm(id) {
    return api.get(`/forms/adjustable-tax/${id}`);
  }

  // Reductions Form
  async saveReductionsForm(data) {
    return api.post('/forms/reductions', data);
  }

  async updateReductionsForm(id, data) {
    return api.put(`/forms/reductions/${id}`, data);
  }

  async getReductionsForm(id) {
    return api.get(`/forms/reductions/${id}`);
  }

  // Credits Form
  async saveCreditsForm(data) {
    return api.post('/forms/credits', data);
  }

  async updateCreditsForm(id, data) {
    return api.put(`/forms/credits/${id}`, data);
  }

  async getCreditsForm(id) {
    return api.get(`/forms/credits/${id}`);
  }

  // Deductions Form
  async saveDeductionsForm(data) {
    return api.post('/forms/deductions', data);
  }

  async updateDeductionsForm(id, data) {
    return api.put(`/forms/deductions/${id}`, data);
  }

  async getDeductionsForm(id) {
    return api.get(`/forms/deductions/${id}`);
  }

  // Final Tax Form
  async saveFinalTaxForm(data) {
    return api.post('/forms/final-tax', data);
  }

  async updateFinalTaxForm(id, data) {
    return api.put(`/forms/final-tax/${id}`, data);
  }

  async getFinalTaxForm(id) {
    return api.get(`/forms/final-tax/${id}`);
  }

  // Capital Gains Form
  async saveCapitalGainsForm(data) {
    return api.post('/forms/capital-gains', data);
  }

  async updateCapitalGainsForm(id, data) {
    return api.put(`/forms/capital-gains/${id}`, data);
  }

  async getCapitalGainsForm(id) {
    return api.get(`/forms/capital-gains/${id}`);
  }

  // Expenses Form
  async saveExpensesForm(data) {
    return api.post('/forms/expenses', data);
  }

  async updateExpensesForm(id, data) {
    return api.put(`/forms/expenses/${id}`, data);
  }

  async getExpensesForm(id) {
    return api.get(`/forms/expenses/${id}`);
  }

  // Wealth Form
  async saveWealthForm(data) {
    return api.post('/forms/wealth', data);
  }

  async updateWealthForm(id, data) {
    return api.put(`/forms/wealth/${id}`, data);
  }

  async getWealthForm(id) {
    return api.get(`/forms/wealth/${id}`);
  }

  // Common operations
  async getTaxYears() {
    return api.get('/tax-years');
  }

  async getEmployers() {
    return api.get('/employers');
  }

  // Form completion status
  async getFormCompletionStatus(taxYearId) {
    return api.get(`/forms/completion-status/${taxYearId}`);
  }

  async updateFormCompletionStatus(taxYearId, formType, status) {
    return api.put(`/forms/completion-status/${taxYearId}`, {
      formType,
      status,
    });
  }
}

export default new TaxFormService(); 