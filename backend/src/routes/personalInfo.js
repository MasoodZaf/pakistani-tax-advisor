const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify session token authentication
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const sessionToken = authHeader.substring(7);

    // Verify session token exists and is valid
    const sessionResult = await pool.query(`
      SELECT us.user_id, us.user_email, u.id, u.email, u.name, u.user_type, u.role, u.is_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid session',
        message: 'Session expired or invalid'
      });
    }

    const sessionData = sessionResult.rows[0];
    req.user = {
      id: sessionData.id,
      email: sessionData.email,
      name: sessionData.name,
      user_type: sessionData.user_type,
      role: sessionData.role,
      is_active: sessionData.is_active
    };
    req.userId = sessionData.user_id;
    req.userEmail = sessionData.user_email;
    next();

  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

// GET personal information for a user and tax year
router.get('/:taxYear', requireAuth, async (req, res) => {
  try {
    const { userId } = req;
    const { taxYear } = req.params;

    const result = await pool.query(`
      SELECT * FROM personal_information
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No personal information found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Personal information retrieved successfully'
    });

  } catch (error) {
    logger.error('Get personal info error:', error);
    res.status(500).json({
      error: 'Failed to retrieve personal information',
      message: error.message
    });
  }
});

// POST/PUT personal information (create or update)
router.post('/:taxYear', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { userId } = req;
    const { taxYear } = req.params;
    const {
      full_name,
      father_name,
      cnic,
      ntn,
      passport_number,
      residential_address,
      mailing_address,
      city,
      province,
      postal_code,
      country,
      mobile_number,
      landline_number,
      email_address,
      profession,
      employer_name,
      employer_address,
      employer_ntn,
      fbr_registration_number,
      tax_circle,
      zone
    } = req.body;

    // Check if record exists
    const existingResult = await client.query(`
      SELECT id FROM personal_information
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    let result;

    if (existingResult.rows.length > 0) {
      // Update existing record
      result = await client.query(`
        UPDATE personal_information SET
          full_name = $3,
          father_name = $4,
          cnic = $5,
          ntn = $6,
          passport_number = $7,
          residential_address = $8,
          mailing_address = $9,
          city = $10,
          province = $11,
          postal_code = $12,
          country = $13,
          mobile_number = $14,
          landline_number = $15,
          email_address = $16,
          profession = $17,
          employer_name = $18,
          employer_address = $19,
          employer_ntn = $20,
          fbr_registration_number = $21,
          tax_circle = $22,
          zone = $23,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND tax_year = $2
        RETURNING *
      `, [
        userId, taxYear, full_name, father_name, cnic, ntn, passport_number,
        residential_address, mailing_address, city, province, postal_code, country,
        mobile_number, landline_number, email_address, profession, employer_name,
        employer_address, employer_ntn, fbr_registration_number, tax_circle, zone
      ]);
    } else {
      // Create new record
      result = await client.query(`
        INSERT INTO personal_information (
          user_id, tax_year, full_name, father_name, cnic, ntn, passport_number,
          residential_address, mailing_address, city, province, postal_code, country,
          mobile_number, landline_number, email_address, profession, employer_name,
          employer_address, employer_ntn, fbr_registration_number, tax_circle, zone
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *
      `, [
        userId, taxYear, full_name, father_name, cnic, ntn, passport_number,
        residential_address, mailing_address, city, province, postal_code, country,
        mobile_number, landline_number, email_address, profession, employer_name,
        employer_address, employer_ntn, fbr_registration_number, tax_circle, zone
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: result.rows[0],
      message: existingResult.rows.length > 0 ?
        'Personal information updated successfully' :
        'Personal information created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Save personal info error:', error);
    res.status(500).json({
      error: 'Failed to save personal information',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// DELETE personal information
router.delete('/:taxYear', requireAuth, async (req, res) => {
  try {
    const { userId } = req;
    const { taxYear } = req.params;

    const result = await pool.query(`
      DELETE FROM personal_information
      WHERE user_id = $1 AND tax_year = $2
      RETURNING *
    `, [userId, taxYear]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Personal information not found',
        message: 'No personal information found to delete'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Personal information deleted successfully'
    });

  } catch (error) {
    logger.error('Delete personal info error:', error);
    res.status(500).json({
      error: 'Failed to delete personal information',
      message: error.message
    });
  }
});

module.exports = router;