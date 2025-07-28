const TaxForm = require('./TaxForm');
const winston = require('winston');
const db = require('../config/database');

class IncomeForm extends TaxForm {
  constructor() {
    super('income_forms');
  }

  async calculateTotalIncome(userId, taxYear) {
    try {
      const result = await db.query(
        `SELECT 
          SUM(monthly_salary * 12 + bonus + car_value + other_taxable_payments) as total_taxable_income,
          SUM(medical_allowance + employer_contribution + other_tax_exempt_payments) as total_exempt_income,
          SUM(tax_deducted) as total_tax_deducted
         FROM income_forms
         WHERE user_id = $1 AND tax_year = $2`,
        [userId, taxYear]
      );
      return {
        totalTaxableIncome: parseFloat(result.rows[0].total_taxable_income || 0),
        totalExemptIncome: parseFloat(result.rows[0].total_exempt_income || 0),
        totalTaxDeducted: parseFloat(result.rows[0].total_tax_deducted || 0)
      };
    } catch (error) {
      winston.error('Error in IncomeForm.calculateTotalIncome:', error);
      throw error;
    }
  }

  async findByEmployer(employerId, taxYear) {
    try {
      const result = await db.query(
        `SELECT * FROM income_forms
         WHERE employer_id = $1 AND tax_year = $2`,
        [employerId, taxYear]
      );
      return result.rows;
    } catch (error) {
      winston.error('Error in IncomeForm.findByEmployer:', error);
      throw error;
    }
  }

  async findMultipleEmployers(userId, taxYear) {
    try {
      const result = await db.query(
        `SELECT * FROM income_forms
         WHERE user_id = $1 
         AND tax_year = $2
         AND multiple_employer = true`,
        [userId, taxYear]
      );
      return result.rows;
    } catch (error) {
      winston.error('Error in IncomeForm.findMultipleEmployers:', error);
      throw error;
    }
  }

  async updateTaxDeducted(id, taxDeducted, userId) {
    try {
      const result = await db.query(
        `UPDATE income_forms
         SET tax_deducted = $1,
             updated_at = NOW(),
             updated_by = $3
         WHERE id = $2
         RETURNING *`,
        [taxDeducted, id, userId]
      );
      return result.rows[0];
    } catch (error) {
      winston.error('Error in IncomeForm.updateTaxDeducted:', error);
      throw error;
    }
  }

  async getIncomeBreakdown(userId, taxYear) {
    try {
      const result = await db.query(
        `SELECT 
          SUM(monthly_salary * 12) as annual_salary,
          SUM(bonus) as total_bonus,
          SUM(car_value) as total_car_value,
          SUM(other_taxable_payments) as other_taxable,
          SUM(medical_allowance) as total_medical,
          SUM(employer_contribution) as total_contribution,
          SUM(other_tax_exempt_payments) as other_exempt
         FROM income_forms
         WHERE user_id = $1 AND tax_year = $2
         GROUP BY user_id, tax_year`,
        [userId, taxYear]
      );
      return result.rows[0];
    } catch (error) {
      winston.error('Error in IncomeForm.getIncomeBreakdown:', error);
      throw error;
    }
  }
}

module.exports = new IncomeForm(); 