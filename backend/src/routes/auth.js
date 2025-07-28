const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

const router = express.Router();

// User Registration
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { email, name, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role)
      VALUES ($1, $2, $3, 'individual', 'user')
      RETURNING id, email, name
    `, [email, name, passwordHash]);
    
    const newUser = userResult.rows[0];
    
    // Get current tax year
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const currentTaxYear = taxYearResult.rows[0];
    
    // Create tax return for current year
    const returnResult = await client.query(`
      INSERT INTO tax_returns (
        user_id, user_email, tax_year_id, tax_year,
        return_number, filing_status, filing_type
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', 'normal')
      RETURNING id
    `, [
      newUser.id,
      newUser.email,
      currentTaxYear.id,
      currentTaxYear.tax_year,
      `TR-${newUser.id.slice(0, 8)}-${currentTaxYear.tax_year}`
    ]);
    
    const taxReturnId = returnResult.rows[0].id;
    
    // Initialize all form tables for current year
    await client.query(`
      INSERT INTO income_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO credits_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO final_tax_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO expenses_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO wealth_forms (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query(`
      INSERT INTO form_completion_status (
        tax_return_id, user_id, user_email,
        tax_year_id, tax_year
      ) VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user: newUser,
      currentTaxYear: currentTaxYear.tax_year
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  } finally {
    client.release();
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Authenticate user
    const user = await pool.query(`
      SELECT id, email, name, password_hash, role, user_type 
      FROM users 
      WHERE email = $1 AND is_active = true
    `, [email]);
    
    if (!user.rows[0] || !await bcrypt.compare(password, user.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const userData = user.rows[0];
    
    // Get user's tax years summary (shows all years)
    const taxYearsSummary = await pool.query(`
      SELECT 
        ty.tax_year,
        ty.is_current,
        tr.id as tax_return_id,
        tr.filing_status,
        tr.return_number,
        fcs.completion_percentage,
        tc.total_tax_liability,
        tc.refund_due,
        tc.additional_tax_due
      FROM tax_years ty
      LEFT JOIN tax_returns tr ON ty.id = tr.tax_year_id AND tr.user_id = $1
      LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
      LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
      WHERE ty.is_active = true
      ORDER BY ty.tax_year DESC
    `, [userData.id]);
    
    // Get current year tax data
    const currentYearData = await pool.query(`
      SELECT 
        tr.id as tax_return_id,
        tr.tax_year,
        tr.filing_status,
        tr.return_number,
        inf.*,
        atf.*,
        rf.*,
        cf.*,
        df.*,
        ftf.*,
        cgf.*,
        ef.*,
        wf.*,
        fcs.completion_percentage,
        tc.total_tax_liability,
        tc.refund_due,
        tc.additional_tax_due
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      LEFT JOIN income_forms inf ON tr.id = inf.tax_return_id
      LEFT JOIN adjustable_tax_forms atf ON tr.id = atf.tax_return_id
      LEFT JOIN reductions_forms rf ON tr.id = rf.tax_return_id
      LEFT JOIN credits_forms cf ON tr.id = cf.tax_return_id
      LEFT JOIN deductions_forms df ON tr.id = df.tax_return_id
      LEFT JOIN final_tax_forms ftf ON tr.id = ftf.tax_return_id
      LEFT JOIN capital_gain_forms cgf ON tr.id = cgf.tax_return_id
      LEFT JOIN expenses_forms ef ON tr.id = ef.tax_return_id
      LEFT JOIN wealth_forms wf ON tr.id = wf.tax_return_id
      LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
      LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
      WHERE tr.user_id = $1 AND ty.is_current = true
    `, [userData.id]);
    
    // Create session
    const sessionToken = uuidv4();
    await pool.query(`
      INSERT INTO user_sessions (
        user_id, user_email, session_token,
        ip_address, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userData.id,
      userData.email,
      sessionToken,
      req.ip,
      new Date(Date.now() + 24*60*60*1000)
    ]);
    
    // Log audit trail
    await pool.query(`
      INSERT INTO audit_log (
        user_id, user_email, action,
        table_name, ip_address, user_agent
      )
      VALUES ($1, $2, 'login', 'users', $3, $4)
    `, [
      userData.id,
      userData.email,
      req.ip,
      req.headers['user-agent']
    ]);
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role
      },
      taxYearsSummary: taxYearsSummary.rows,
      currentYearData: currentYearData.rows[0],
      sessionToken
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

module.exports = router;
