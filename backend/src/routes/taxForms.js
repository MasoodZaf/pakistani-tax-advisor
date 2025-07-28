const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// Get tax years
router.get('/tax-years', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tax_years WHERE is_active = true ORDER BY tax_year DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tax years error:', error);
    res.status(500).json({ error: 'Failed to get tax years' });
  }
});

// Get employers
router.get('/employers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM organizations WHERE is_active = true ORDER BY name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get employers error:', error);
    res.status(500).json({ error: 'Failed to get employers' });
  }
});

// Update income form
router.put('/forms/income/:taxYear', async (req, res) => {
  try {
    const { taxYear } = req.params;
    const { userId, userEmail, formData } = req.body;
    
    // Get tax return for specific year
    const taxReturnQuery = await pool.query(`
      SELECT tr.id as tax_return_id, ty.id as tax_year_id
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      JOIN users u ON tr.user_id = u.id
      WHERE tr.user_id = $1 AND tr.user_email = $2 AND ty.tax_year = $3 
      AND u.email = $2 AND u.is_active = true
    `, [userId, userEmail, taxYear]);
    
    if (taxReturnQuery.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tax return not found',
        message: `No tax return found for ${taxYear}. Create one first.`
      });
    }
    
    const { tax_return_id: taxReturnId, tax_year_id: taxYearId } = taxReturnQuery.rows[0];
    
    // Update income form for specific year
    const updateResult = await pool.query(`
      UPDATE income_forms SET
        monthly_salary = $4,
        bonus = $5,
        car_allowance = $6,
        other_taxable = $7,
        salary_tax_deducted = $8,
        multiple_employer = $9,
        additional_tax_deducted = $10,
        medical_allowance = $11,
        employer_contribution = $12,
        other_exempt = $13,
        other_sources = $14,
        is_complete = $15,
        last_updated_by = $2,
        updated_at = NOW()
      WHERE tax_return_id = $1 AND user_id = $2 AND user_email = $3 AND tax_year = $16
      RETURNING 
        total_gross_income,
        total_exempt_income,
        total_taxable_income,
        is_complete,
        tax_year
    `, [
      taxReturnId, userId, userEmail,
      formData.monthly_salary || 0,
      formData.bonus || 0,
      formData.car_allowance || 0,
      formData.other_taxable || 0,
      formData.salary_tax_deducted || 0,
      formData.multiple_employer || null,
      formData.additional_tax_deducted || 0,
      formData.medical_allowance || 0,
      formData.employer_contribution || 0,
      formData.other_exempt || 0,
      formData.other_sources || 0,
      formData.is_complete || false,
      taxYear
    ]);
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Income form not found for this year' });
    }
    
    // Log audit trail
    await pool.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id, 
        field_name, new_value, ip_address, user_agent, category
      ) VALUES ($1, $2, 'update', 'income_forms', $3, $4, $5, $6, $7, $8)
    `, [
      userId, userEmail, taxReturnId, 
      `income_form_${taxYear}`, JSON.stringify(formData), 
      req.ip, req.headers['user-agent'], `form_update_${taxYear}`
    ]);
    
    // Trigger tax calculation if form is complete
    if (formData.is_complete) {
      // Get tax slabs for specific year
      const taxSlabs = await pool.query(`
        SELECT * FROM tax_slabs
        WHERE tax_year_id = $1
        ORDER BY slab_order
      `, [taxYearId]);
      
      // Calculate tax based on taxable income
      const taxableIncome = updateResult.rows[0].total_taxable_income;
      let tax = 0;
      let remainingIncome = taxableIncome;
      
      for (const slab of taxSlabs.rows) {
        if (remainingIncome <= 0) break;
        
        const slabIncome = Math.min(
          remainingIncome,
          (slab.max_income || Infinity) - slab.min_income + 1
        );
        
        if (taxableIncome > slab.min_income) {
          tax += slabIncome * parseFloat(slab.tax_rate);
          remainingIncome -= slabIncome;
        }
      }
      
      // Save calculation
      await pool.query(`
        INSERT INTO tax_calculations (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          calculation_type, calculation_version, gross_income,
          exempt_income, taxable_income, normal_tax, tax_reductions,
          tax_credits, final_tax, capital_gains_tax, total_tax_liability,
          advance_tax_paid, adjustable_tax_paid, total_tax_paid,
          refund_due, additional_tax_due, is_final
        ) VALUES (
          $1, $2, $3, $4, $5, 'auto', '1.0',
          $6, $7, $8, $9, 0, 0, 0, 0, $9,
          0, $10, $10, $11, $12, true
        )
      `, [
        taxReturnId, userId, userEmail, taxYearId, taxYear,
        updateResult.rows[0].total_gross_income,
        updateResult.rows[0].total_exempt_income,
        taxableIncome,
        tax,
        formData.salary_tax_deducted || 0,
        Math.max(0, formData.salary_tax_deducted - tax),
        Math.max(0, tax - formData.salary_tax_deducted)
      ]);
    }
    
    res.json({
      success: true,
      data: updateResult.rows[0],
      message: `Income form updated successfully for ${taxYear}`,
      taxYear
    });
    
  } catch (error) {
    console.error('Income form update error:', error);
    res.status(500).json({ error: 'Failed to update income form', message: error.message });
  }
});

// Get form completion status
router.get('/forms/completion-status/:taxYearId', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const result = await pool.query(`
      SELECT * FROM form_completion_status
      WHERE tax_year_id = $1
    `, [taxYearId]);
    
    res.json({
      success: true,
      data: result.rows[0] || {}
    });
  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
});

// Update form completion status
router.put('/forms/completion-status/:taxYearId', async (req, res) => {
  try {
    const { taxYearId } = req.params;
    const { formType, status } = req.body;
    
    const updateField = `${formType.replace(/-/g, '_')}_complete`;
    
    const result = await pool.query(`
      UPDATE form_completion_status
      SET ${updateField} = $1,
          last_form_updated = $2,
          last_updated_at = NOW()
      WHERE tax_year_id = $3
      RETURNING *
    `, [status === 'completed', formType, taxYearId]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update completion status error:', error);
    res.status(500).json({ error: 'Failed to update completion status' });
  }
});

module.exports = router; 