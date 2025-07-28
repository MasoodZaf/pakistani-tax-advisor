const BaseModel = require('./BaseModel');
const winston = require('winston');
const db = require('../config/database');

class TaxForm extends BaseModel {
  constructor(tableName) {
    super(tableName);
  }

  async findByUserAndTaxYear(userId, taxYear) {
    try {
      const result = await db.query(
        `SELECT * FROM ${this.tableName}
         WHERE user_id = $1 AND tax_year = $2`,
        [userId, taxYear]
      );
      return result.rows;
    } catch (error) {
      winston.error(`Error in ${this.tableName}.findByUserAndTaxYear:`, error);
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      const result = await db.query(
        `SELECT * FROM ${this.tableName}
         WHERE status = $1`,
        [status]
      );
      return result.rows;
    } catch (error) {
      winston.error(`Error in ${this.tableName}.findByStatus:`, error);
      throw error;
    }
  }

  async updateStatus(id, status, userId) {
    try {
      const result = await db.query(
        `UPDATE ${this.tableName}
         SET status = $1, updated_at = NOW(), updated_by = $3
         WHERE id = $2
         RETURNING *`,
        [status, id, userId]
      );
      return result.rows[0];
    } catch (error) {
      winston.error(`Error in ${this.tableName}.updateStatus:`, error);
      throw error;
    }
  }

  async calculateTotalAmount(userId, taxYear) {
    try {
      const result = await db.query(
        `SELECT SUM(amount) as total_amount
         FROM ${this.tableName}
         WHERE user_id = $1 AND tax_year = $2`,
        [userId, taxYear]
      );
      return parseFloat(result.rows[0].total_amount || 0);
    } catch (error) {
      winston.error(`Error in ${this.tableName}.calculateTotalAmount:`, error);
      throw error;
    }
  }

  async findWithAuditTrail(id) {
    try {
      const result = await db.query(
        `SELECT f.*, 
                a.action,
                a.changed_fields,
                a.old_values,
                a.new_values,
                a.changed_at,
                a.changed_by
         FROM ${this.tableName} f
         LEFT JOIN audit_trail a ON a.table_name = $1 AND a.record_id = f.id
         WHERE f.id = $2
         ORDER BY a.changed_at DESC`,
        [this.tableName, id]
      );
      return result.rows;
    } catch (error) {
      winston.error(`Error in ${this.tableName}.findWithAuditTrail:`, error);
      throw error;
    }
  }
}

module.exports = TaxForm; 